import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

// ── CORS headers ──────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

function corsResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// ── Cost per token by model family ────────────────────────────────────────────

function costPerToken(model: string): number {
  if (model.startsWith('claude-opus-')) return 0.000075;
  if (model.startsWith('claude-sonnet-')) return 0.000015;
  return 0.000003; // haiku or unknown claude-* variants
}

function normalizeExecutionModel(model: string): string {
  const normalized = String(model || '').trim().toLowerCase();

  if (!normalized) return '';
  if (normalized.startsWith('claude-')) return normalized;

  const aliases: Record<string, string> = {
    'claude opus 4.6': 'claude-opus-4-6',
    'claude sonnet 4.6': 'claude-sonnet-4-6',
    'claude sonnet 4.5': 'claude-sonnet-4-5',
  };

  return aliases[normalized] || normalized.replace(/\s+/g, '-');
}

type TaskGraphRow = {
  id: string;
  user_id: string;
  title?: string | null;
  name?: string | null;
  description?: string | null;
  status?: string | null;
  parent_id?: string | null;
  root_mission_id?: string | null;
  node_type?: string | null;
  workflow_status?: string | null;
  depends_on?: string[] | null;
  result_text?: string | null;
  domain?: string | null;
  intent_type?: string | null;
  budget_class?: string | null;
  risk_level?: string | null;
  approval_level?: string | null;
  execution_strategy?: string | null;
  context_pack_ids?: unknown;
  required_capabilities?: unknown;
  model_override?: string | null;
  provider_override?: string | null;
};

type AgentCleanupRow = {
  id: string;
  name?: string | null;
  role?: string | null;
  model?: string | null;
  is_ephemeral?: boolean | null;
};

function isTaskComplete(task: TaskGraphRow): boolean {
  return ['completed', 'done'].includes(String(task.status || '').toLowerCase())
    || String(task.workflow_status || '').toLowerCase() === 'completed';
}

function isTaskFailed(task: TaskGraphRow): boolean {
  return ['failed', 'error', 'blocked', 'cancelled'].includes(String(task.status || '').toLowerCase())
    || ['failed', 'blocked', 'cancelled'].includes(String(task.workflow_status || '').toLowerCase());
}

function scoreOutcome(task: { approval_level?: string | null; execution_strategy?: string | null }, cost: number, latency: number, status: 'completed' | 'failed') {
  let score = 52;
  if (status === 'completed') score += 24;
  if (status === 'failed') score -= 30;
  if (String(task.approval_level || '') === 'human_required') score -= 6;
  if (String(task.execution_strategy || '') === 'parallel') score += 4;
  if (cost <= 0.75) score += 5;
  if (latency > 0 && latency <= 12 * 60 * 1000) score += 4;
  if (latency > 50 * 60 * 1000) score -= 4;
  const finalScore = Math.min(100, Math.max(0, Math.round(score)));
  const trust = finalScore >= 80 ? 'high' : finalScore >= 60 ? 'medium' : 'low';
  return { finalScore, trust };
}

function buildDoctrineFeedback(task: { budget_class?: string | null; risk_level?: string | null; model_override?: string | null }, score: number, cost: number) {
  if (score < 55) return 'This lane underperformed. Tighten context packs, review branch decomposition, or escalate to a stronger model.';
  if (String(task.risk_level || '') === 'low' && String(task.budget_class || '') !== 'premium' && cost > 1.25) {
    return 'Low-risk work cleared at a relatively high cost. Bias similar branches toward a local or cheaper lane first.';
  }
  return `This route is holding up well. Preserve the current lane${task.model_override ? ` around ${task.model_override}` : ''} as a preferred doctrine candidate.`;
}

async function updateMissionGraphProgress(db: ReturnType<typeof createClient>, task: TaskGraphRow) {
  if (!task.parent_id || !task.root_mission_id) return;

  const { data: subtaskRows, error } = await db
    .from('tasks')
    .select('id,user_id,status,parent_id,root_mission_id,node_type,workflow_status,depends_on,result_text')
    .eq('root_mission_id', task.root_mission_id)
    .eq('parent_id', task.parent_id)
    .order('created_at', { ascending: true });

  if (error || !subtaskRows) return;

  const subtasks = subtaskRows as TaskGraphRow[];
  const completedIds = new Set(subtasks.filter(isTaskComplete).map((row) => row.id));
  const completedCount = subtasks.filter(isTaskComplete).length;
  const failedCount = subtasks.filter(isTaskFailed).length;
  const totalCount = subtasks.length || 1;

  const nextTask = subtasks.find((row) => {
    const workflow = String(row.workflow_status || '').toLowerCase();
    if (!['planned', 'intake'].includes(workflow) && String(row.status || '').toLowerCase() !== 'pending') return false;
    const dependencies = Array.isArray(row.depends_on) ? row.depends_on : [];
    return dependencies.every((dependencyId) => completedIds.has(dependencyId));
  });

  if (nextTask) {
    await db.from('tasks').update({
      status: 'queued',
      workflow_status: 'ready',
      lane: 'active',
      updated_at: new Date().toISOString(),
    }).eq('id', nextTask.id).eq('user_id', task.user_id);
  }

  const rootUpdate = failedCount > 0
    ? {
      status: 'failed',
      workflow_status: 'blocked',
      lane: 'blocked',
      progress_percent: Math.min(99, Math.round((completedCount / totalCount) * 100)),
      updated_at: new Date().toISOString(),
    }
    : completedCount >= totalCount
      ? {
        status: 'completed',
        workflow_status: 'completed',
        lane: 'completed',
        progress_percent: 100,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      : {
        status: 'running',
        workflow_status: 'running',
        lane: 'active',
        progress_percent: Math.max(10, Math.round((completedCount / totalCount) * 100)),
        updated_at: new Date().toISOString(),
      };

  await db.from('tasks').update(rootUpdate).eq('id', task.parent_id).eq('user_id', task.user_id);
}

async function cleanupEphemeralSpecialists(
  db: ReturnType<typeof createClient>,
  userId: string,
  rootMissionId: string | null | undefined,
) {
  if (!rootMissionId) return;

  const { data: missionAgents, error: missionAgentsError } = await db
    .from('tasks')
    .select('agent_id')
    .eq('user_id', userId)
    .eq('root_mission_id', rootMissionId)
    .not('agent_id', 'is', null);

  if (missionAgentsError || !missionAgents?.length) return;

  const candidateIds = [...new Set(missionAgents.map((row) => row.agent_id).filter(Boolean))];
  if (!candidateIds.length) return;

  const { data: ephemeralAgents, error: agentError } = await db
    .from('agents')
    .select('id,name,role,model,is_ephemeral')
    .eq('user_id', userId)
    .in('id', candidateIds)
    .eq('is_ephemeral', true);

  if (agentError || !ephemeralAgents?.length) return;

  const ephemeralRows = ephemeralAgents as AgentCleanupRow[];
  const ephemeralIds = ephemeralRows.map((agent) => agent.id);
  if (!ephemeralIds.length) return;

  const { data: activeAssignments, error: activeError } = await db
    .from('tasks')
    .select('agent_id,status,workflow_status')
    .eq('user_id', userId)
    .in('agent_id', ephemeralIds);

  if (activeError) return;

  const activeStatuses = new Set(['queued', 'running', 'pending', 'needs_approval']);
  const activeWorkflow = new Set(['intake', 'planned', 'ready', 'running', 'waiting_on_human']);
  const agentsInUse = new Set(
    (activeAssignments || [])
      .filter((row) => (
        activeStatuses.has(String(row.status || '').toLowerCase())
        || activeWorkflow.has(String(row.workflow_status || '').toLowerCase())
      ))
      .map((row) => row.agent_id)
      .filter(Boolean),
  );

  const staleEphemeralIds = ephemeralIds.filter((agentId) => !agentsInUse.has(agentId));
  if (!staleEphemeralIds.length) return;

  const staleAgents = ephemeralRows.filter((agent) => staleEphemeralIds.includes(agent.id));
  if (staleAgents.length) {
    await db.from('activity_log').insert(
      staleAgents.map((agent) => ({
        user_id: userId,
        type: 'SYS',
        message: `[specialist-retired] ${agent.name || agent.id} (${agent.role || 'specialist'}) retired after mission ${rootMissionId} on ${agent.model || 'adaptive lane'}.`,
        agent_id: agent.id,
        tokens: 0,
        duration_ms: 0,
      })),
    );
  }

  await db
    .from('agents')
    .delete()
    .eq('user_id', userId)
    .eq('is_ephemeral', true)
    .in('id', staleEphemeralIds);
}

// ── max_tokens by response_length ────────────────────────────────────────────

const MAX_TOKENS_MAP: Record<string, number> = {
  short: 512,
  medium: 2048,
  long: 8192,
  unlimited: 16000,
};

// ── Main handler ──────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // ── Parse body ───────────────────────────────────────────────────────────

  let body: { agent_id?: string; task_description?: string; task_id?: string };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { agent_id, task_description, task_id } = body;
  if (!agent_id || !task_description) {
    return corsResponse({ error: 'Missing required fields: agent_id, task_description' }, 400);
  }

  // ── Auth ─────────────────────────────────────────────────────────────────

  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return corsResponse({ error: 'Missing or malformed Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: { user }, error: authError } = await authClient.auth.getUser(token);
  if (authError || !user) {
    return corsResponse({ error: 'Unauthorized — invalid or expired token' }, 401);
  }

  // Service role client for all DB writes (bypasses RLS)
  const db = createClient(supabaseUrl, serviceRoleKey);

  let taskRow: TaskGraphRow | null = null;
  if (task_id) {
    const { data } = await db
      .from('tasks')
      .select('id,user_id,title,name,description,status,parent_id,root_mission_id,node_type,workflow_status,depends_on,result_text,domain,intent_type,budget_class,risk_level,approval_level,execution_strategy,context_pack_ids,required_capabilities,model_override,provider_override')
      .eq('id', task_id)
      .single();
    taskRow = (data as TaskGraphRow) || null;
  }

  // ── Fetch agent ──────────────────────────────────────────────────────────

  const { data: agent, error: agentError } = await db
    .from('agents')
    .select('*')
    .eq('id', agent_id)
    .single();

  if (agentError || !agent) {
    return corsResponse({ error: 'Agent not found' }, 404);
  }

  if (agent.user_id !== user.id) {
    return corsResponse({ error: 'Forbidden — agent does not belong to this user' }, 403);
  }

  const executionModel = normalizeExecutionModel(agent.model);

  if (!executionModel.startsWith('claude-')) {
    return corsResponse({ error: 'Model not yet supported in Phase 1' }, 422);
  }

  // ── Fetch user's Anthropic API key ───────────────────────────────────────

  const { data: userSettings } = await db
    .from('user_settings')
    .select('anthropic_api_key')
    .eq('user_id', user.id)
    .single();

  if (!userSettings?.anthropic_api_key) {
    return corsResponse({ error: 'No Anthropic API key set. Add it in Settings → Integrations.' }, 400);
  }

  // ── Mark processing ──────────────────────────────────────────────────────

  await db.from('agents').update({ status: 'processing' }).eq('id', agent_id);

  if (task_id) {
    await db.from('tasks').update({
      status: 'running',
      workflow_status: 'running',
      lane: 'active',
      started_at: new Date().toISOString(),
      progress_percent: 15,
      updated_at: new Date().toISOString(),
    }).eq('id', task_id).eq('user_id', user.id);
  }

  // ── Call Anthropic ───────────────────────────────────────────────────────

  const startTime = Date.now();

  try {
    const anthropic = new Anthropic({ apiKey: userSettings.anthropic_api_key });

    const aiResponse = await anthropic.messages.create({
      model: executionModel,
      system: agent.system_prompt || '',
      messages: [{ role: 'user', content: task_description }],
      temperature: parseFloat(agent.temperature) ?? 0.7,
      max_tokens: MAX_TOKENS_MAP[agent.response_length as string] ?? 2048,
    });

    const latency = Date.now() - startTime;
    const responseText = (aiResponse.content[0] as { type: string; text: string }).text;
    const tokens = aiResponse.usage.input_tokens + aiResponse.usage.output_tokens;
    const cost = tokens * costPerToken(agent.model);

    const taskId = task_id || crypto.randomUUID();
    const reviewId = crypto.randomUUID();
    const completedAt = new Date().toISOString();
    const taskWrite = task_id
      ? db.from('tasks').update({
        status: 'completed',
        workflow_status: 'completed',
        lane: 'completed',
        duration_ms: latency,
        cost_usd: cost,
        actual_cost_cents: Math.round(cost * 100),
        progress_percent: 100,
        prompt_text: task_description,
        result_text: responseText,
        completed_at: completedAt,
        last_run_at: completedAt,
        updated_at: completedAt,
      }).eq('id', taskId).eq('user_id', user.id)
      : db.from('tasks').insert({
        id: taskId,
        user_id: user.id,
        name: task_description.substring(0, 120),
        status: 'completed',
        workflow_status: 'completed',
        agent_id: agent.id,
        agent_name: agent.name,
        duration_ms: latency,
        cost_usd: cost,
        prompt_text: task_description,
        result_text: responseText,
        completed_at: completedAt,
      });

    const outcome = scoreOutcome(taskRow || {}, cost, latency, 'completed');
    const doctrineFeedback = buildDoctrineFeedback(taskRow || {}, outcome.finalScore, cost);

    await Promise.all([
      db.from('agents').update({
        status: 'idle',
        latency_ms: latency,
        total_tokens: (agent.total_tokens ?? 0) + tokens,
        total_cost: parseFloat(agent.total_cost ?? 0) + cost,
        task_count: (agent.task_count ?? 0) + 1,
      }).eq('id', agent_id),

      taskWrite,

      db.from('activity_log').insert({
        user_id: user.id,
        type: 'OK',
        message: ('Task completed: ' + task_description).substring(0, 120),
        agent_id: agent.id,
        tokens,
        duration_ms: latency,
      }),
      db.from('activity_log').insert({
        user_id: user.id,
        type: 'SYS',
        message: `[outcome-score] root ${taskRow?.root_mission_id || taskId} score ${outcome.finalScore} trust ${outcome.trust} for ${task_description.substring(0, 80)}.`,
        agent_id: agent.id,
        tokens: 0,
        duration_ms: latency,
      }),
      db.from('activity_log').insert({
        user_id: user.id,
        type: 'SYS',
        message: `[doctrine-feedback] root ${taskRow?.root_mission_id || taskId} ${doctrineFeedback}`,
        agent_id: agent.id,
        tokens: 0,
        duration_ms: 0,
      }),
      db.from('task_outcomes').upsert({
        user_id: user.id,
        task_id: taskId,
        root_mission_id: taskRow?.root_mission_id || taskId,
        agent_id: agent.id,
        outcome_status: 'completed',
        score: outcome.finalScore,
        trust: outcome.trust,
        doctrine_feedback: doctrineFeedback,
        model: taskRow?.model_override || agent.model || null,
        provider: taskRow?.provider_override || null,
        domain: taskRow?.domain || 'general',
        intent_type: taskRow?.intent_type || 'general',
        budget_class: taskRow?.budget_class || 'balanced',
        risk_level: taskRow?.risk_level || 'medium',
        approval_level: taskRow?.approval_level || 'risk_weighted',
        execution_strategy: taskRow?.execution_strategy || 'sequential',
        cost_usd: cost,
        duration_ms: latency,
        context_pack_ids: Array.isArray(taskRow?.context_pack_ids) ? taskRow?.context_pack_ids : [],
        required_capabilities: Array.isArray(taskRow?.required_capabilities) ? taskRow?.required_capabilities : [],
        metadata: { source: 'dispatch-task' },
      }, { onConflict: 'task_id,outcome_status' }),

      db.from('pending_reviews').insert({
        id: reviewId,
        user_id: user.id,
        agent_id: agent.id,
        agent_name: agent.name,
        urgency: 'normal',
        title: task_description.substring(0, 120),
        output_type: 'message',
        status: 'awaiting_approval',
        summary: responseText.substring(0, 200),
        payload: JSON.stringify({ content: responseText }),
      }),
    ]);

    if (taskRow) {
      await updateMissionGraphProgress(db, { ...taskRow, status: 'completed', workflow_status: 'completed', result_text: responseText });
      await cleanupEphemeralSpecialists(db, user.id, taskRow.root_mission_id);
    }

    return corsResponse({
      success: true,
      review_id: reviewId,
      task_id: taskId,
      tokens_used: tokens,
      latency_ms: latency,
    });

  } catch (err: unknown) {
    const error = err instanceof Error ? err : new Error(String(err));
    const latency = Date.now() - startTime;

    await db.from('agents').update({ status: 'idle' }).eq('id', agent_id);

    if (task_id) {
      await db.from('tasks').update({
        status: 'failed',
        workflow_status: 'failed',
        lane: 'blocked',
        failed_at: new Date().toISOString(),
        progress_percent: 0,
        updated_at: new Date().toISOString(),
      }).eq('id', task_id).eq('user_id', user.id);
    }

    const outcome = scoreOutcome(taskRow || {}, 0, latency, 'failed');
    if (taskRow) {
      await updateMissionGraphProgress(db, { ...taskRow, status: 'failed', workflow_status: 'failed' });
      await cleanupEphemeralSpecialists(db, user.id, taskRow.root_mission_id);
    }

    await Promise.all([
      db.from('activity_log').insert({
        user_id: user.id,
        type: 'ERR',
        message: error.message.substring(0, 200),
        agent_id: agent_id,
        tokens: 0,
        duration_ms: latency,
      }),
      db.from('activity_log').insert({
        user_id: user.id,
        type: 'SYS',
        message: `[outcome-score] root ${taskRow?.root_mission_id || task_id || 'unknown'} score ${outcome.finalScore} trust ${outcome.trust} for failed branch.`,
        agent_id: agent_id,
        tokens: 0,
        duration_ms: latency,
      }),
      db.from('activity_log').insert({
        user_id: user.id,
        type: 'SYS',
        message: `[doctrine-feedback] root ${taskRow?.root_mission_id || task_id || 'unknown'} Failure path detected. Escalate similar branches or add stronger verifier coverage before scaling.`,
        agent_id: agent_id,
        tokens: 0,
        duration_ms: 0,
      }),
      db.from('task_outcomes').upsert({
        user_id: user.id,
        task_id: task_id || null,
        root_mission_id: taskRow?.root_mission_id || task_id || null,
        agent_id: agent_id,
        outcome_status: 'failed',
        score: outcome.finalScore,
        trust: outcome.trust,
        doctrine_feedback: 'Failure path detected. Escalate similar branches or add stronger verifier coverage before scaling.',
        model: taskRow?.model_override || agent?.model || null,
        provider: taskRow?.provider_override || null,
        domain: taskRow?.domain || 'general',
        intent_type: taskRow?.intent_type || 'general',
        budget_class: taskRow?.budget_class || 'balanced',
        risk_level: taskRow?.risk_level || 'medium',
        approval_level: taskRow?.approval_level || 'risk_weighted',
        execution_strategy: taskRow?.execution_strategy || 'sequential',
        cost_usd: 0,
        duration_ms: latency,
        context_pack_ids: Array.isArray(taskRow?.context_pack_ids) ? taskRow?.context_pack_ids : [],
        required_capabilities: Array.isArray(taskRow?.required_capabilities) ? taskRow?.required_capabilities : [],
        metadata: { source: 'dispatch-task' },
      }, { onConflict: 'task_id,outcome_status' }),
    ]);

    return corsResponse({ error: error.message }, 500);
  }
});
