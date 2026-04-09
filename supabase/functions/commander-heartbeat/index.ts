import Anthropic from 'npm:@anthropic-ai/sdk';
import { createClient } from 'npm:@supabase/supabase-js';

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

function costPerToken(model: string): number {
  if (model.startsWith('claude-opus-')) return 0.000075;
  if (model.startsWith('claude-sonnet-')) return 0.000015;
  return 0.000003;
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

const MAX_TOKENS_MAP: Record<string, number> = {
  short: 512,
  medium: 2048,
  long: 8192,
  unlimited: 16000,
};

type AgentRow = {
  id: string;
  user_id: string;
  name: string;
  model: string;
  status: string;
  system_prompt?: string | null;
  temperature?: number | string | null;
  response_length?: string | null;
  role?: string | null;
  last_heartbeat?: string | null;
  total_tokens?: number | null;
  total_cost?: number | string | null;
  task_count?: number | null;
  latency_ms?: number | null;
};

type TaskRow = {
  id: string;
  user_id: string;
  name?: string | null;
  title?: string | null;
  description?: string | null;
  status: string;
  agent_id?: string | null;
  created_by_commander_id?: string | null;
  priority?: number | null;
  progress_percent?: number | null;
  run_at?: string | null;
  started_at?: string | null;
  created_at?: string | null;
};

type ReviewRow = {
  agent_id?: string | null;
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const heartbeatSecret = Deno.env.get('COMMANDER_HEARTBEAT_SECRET');
  if (heartbeatSecret) {
    const supplied = req.headers.get('x-commander-heartbeat-secret');
    if (supplied !== heartbeatSecret) {
      return corsResponse({ error: 'Forbidden' }, 403);
    }
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) {
    return corsResponse({ error: 'Missing Supabase service configuration' }, 500);
  }

  const db = createClient(supabaseUrl, serviceRoleKey);
  const nowIso = new Date().toISOString();
  const nowMs = Date.now();

  const [{ data: commanders, error: commanderError }, { data: queuedTasks, error: taskError }, { data: reviews, error: reviewsError }] = await Promise.all([
    db
      .from('agents')
      .select('id,user_id,name,model,status,system_prompt,temperature,response_length,last_heartbeat,total_tokens,total_cost,task_count,latency_ms,role')
      .eq('role', 'commander'),
    db
      .from('tasks')
      .select('id,user_id,name,title,description,status,agent_id,created_by_commander_id,priority,progress_percent,run_at,started_at,created_at')
      .eq('status', 'queued')
      .order('priority', { ascending: false })
      .order('created_at', { ascending: true }),
    db
      .from('pending_reviews')
      .select('agent_id')
      .in('status', ['awaiting_approval', 'needs_intervention']),
  ]);

  if (commanderError) return corsResponse({ error: commanderError.message }, 500);
  if (taskError) return corsResponse({ error: taskError.message }, 500);
  if (reviewsError) return corsResponse({ error: reviewsError.message }, 500);

  const commanderRows = (commanders || []) as AgentRow[];
  const taskRows = (queuedTasks || []) as TaskRow[];
  const reviewRows = (reviews || []) as ReviewRow[];

  if (commanderRows.length > 0) {
    await db
      .from('agents')
      .update({ last_heartbeat: nowIso })
      .in('id', commanderRows.map((commander) => commander.id));
  }

  const commandersByUser = new Map(commanderRows.map((commander) => [commander.user_id, commander]));
  const busyAgentIds = new Set(
    commanderRows
      .filter((agent) => agent.status === 'processing')
      .map((agent) => agent.id)
  );

  const { data: busyAgents } = await db
    .from('agents')
    .select('id')
    .eq('status', 'processing');

  (busyAgents || []).forEach((agent) => {
    if (agent.id) busyAgentIds.add(agent.id);
  });

  const blockedReviewAgentIds = new Set(reviewRows.map((review) => review.agent_id).filter(Boolean));
  const userSettingsCache = new Map<string, { anthropic_api_key: string | null }>();
  const agentCache = new Map<string, AgentRow>();
  commanderRows.forEach((agent) => agentCache.set(agent.id, agent));

  let scanned = 0;
  let dispatched = 0;
  const errors: Array<{ taskId: string; message: string }> = [];

  for (const task of taskRows) {
    scanned += 1;

    const dueAtMs = task.run_at ? new Date(task.run_at).getTime() : nowMs;
    if (Number.isNaN(dueAtMs) || dueAtMs > nowMs) continue;

    const commander = commandersByUser.get(task.user_id);
    if (!commander) continue;

    const effectiveAgentId = task.agent_id || commander.id;
    if (!effectiveAgentId) continue;
    if (busyAgentIds.has(effectiveAgentId)) continue;
    if (blockedReviewAgentIds.has(effectiveAgentId)) continue;

    let agent = agentCache.get(effectiveAgentId);
    if (!agent) {
      const { data: agentRow, error: agentError } = await db
        .from('agents')
        .select('id,user_id,name,model,status,system_prompt,temperature,response_length,last_heartbeat,total_tokens,total_cost,task_count,latency_ms,role')
        .eq('id', effectiveAgentId)
        .single();

      if (agentError || !agentRow) {
        errors.push({ taskId: task.id, message: agentError?.message || 'Assigned agent not found' });
        continue;
      }

      agent = agentRow as AgentRow;
      agentCache.set(agent.id, agent);
    }

    if (agent.user_id !== task.user_id) {
      errors.push({ taskId: task.id, message: 'Assigned agent does not belong to task owner' });
      continue;
    }

    const executionModel = normalizeExecutionModel(agent.model);
    if (!executionModel.startsWith('claude-')) {
      errors.push({ taskId: task.id, message: `Unsupported model ${agent.model}` });
      continue;
    }

    let userSettings = userSettingsCache.get(task.user_id);
    if (!userSettings) {
      const { data: settingsRow, error: settingsError } = await db
        .from('user_settings')
        .select('anthropic_api_key')
        .eq('user_id', task.user_id)
        .single();

      if (settingsError || !settingsRow?.anthropic_api_key) {
        errors.push({ taskId: task.id, message: settingsError?.message || 'Missing Anthropic API key' });
        continue;
      }

      userSettings = settingsRow as { anthropic_api_key: string | null };
      userSettingsCache.set(task.user_id, userSettings);
    }

    const claimAt = new Date().toISOString();
    const { data: claimedTask, error: claimError } = await db
      .from('tasks')
      .update({
        agent_id: effectiveAgentId,
        created_by_commander_id: task.created_by_commander_id || commander.id,
        status: 'running',
        lane: 'active',
        started_at: task.started_at || claimAt,
        progress_percent: Math.max(15, Number(task.progress_percent || 0)),
        updated_at: claimAt,
      })
      .eq('id', task.id)
      .eq('user_id', task.user_id)
      .eq('status', 'queued')
      .select('id')
      .maybeSingle();

    if (claimError || !claimedTask) {
      if (claimError) errors.push({ taskId: task.id, message: claimError.message });
      continue;
    }

    busyAgentIds.add(effectiveAgentId);
    await db.from('agents').update({ status: 'processing', last_heartbeat: claimAt }).eq('id', effectiveAgentId);

    const prompt = task.description || task.title || task.name || 'Execute queued mission';
    const startTime = Date.now();

    try {
      const anthropic = new Anthropic({ apiKey: userSettings.anthropic_api_key || '' });
      const aiResponse = await anthropic.messages.create({
        model: executionModel,
        system: agent.system_prompt || '',
        messages: [{ role: 'user', content: prompt }],
        temperature: parseFloat(String(agent.temperature ?? 0.7)) || 0.7,
        max_tokens: MAX_TOKENS_MAP[agent.response_length || 'medium'] ?? 2048,
      });

      const latency = Date.now() - startTime;
      const responseText = (aiResponse.content[0] as { type: string; text: string }).text;
      const tokens = aiResponse.usage.input_tokens + aiResponse.usage.output_tokens;
      const cost = tokens * costPerToken(executionModel);
      const completedAt = new Date().toISOString();
      const reviewId = crypto.randomUUID();

      await Promise.all([
        db.from('agents').update({
          status: 'idle',
          last_heartbeat: completedAt,
          latency_ms: latency,
          total_tokens: Number(agent.total_tokens || 0) + tokens,
          total_cost: Number(agent.total_cost || 0) + cost,
          task_count: Number(agent.task_count || 0) + 1,
        }).eq('id', effectiveAgentId),

        db.from('tasks').update({
          status: 'completed',
          lane: 'completed',
          duration_ms: latency,
          cost_usd: cost,
          actual_cost_cents: Math.round(cost * 100),
          progress_percent: 100,
          prompt_text: prompt,
          result_text: responseText,
          completed_at: completedAt,
          last_run_at: completedAt,
          updated_at: completedAt,
        }).eq('id', task.id).eq('user_id', task.user_id),

        db.from('activity_log').insert({
          user_id: task.user_id,
          type: 'OK',
          message: (`Task completed: ${prompt}`).substring(0, 120),
          agent_id: effectiveAgentId,
          tokens,
          duration_ms: latency,
        }),

        db.from('pending_reviews').insert({
          id: reviewId,
          user_id: task.user_id,
          agent_id: effectiveAgentId,
          agent_name: agent.name,
          urgency: 'normal',
          title: (task.title || task.name || prompt).substring(0, 120),
          output_type: 'message',
          status: 'awaiting_approval',
          summary: responseText.substring(0, 200),
          payload: JSON.stringify({ content: responseText, task_id: task.id }),
        }),
      ]);

      dispatched += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failedAt = new Date().toISOString();

      await Promise.all([
        db.from('agents').update({ status: 'idle', last_heartbeat: failedAt }).eq('id', effectiveAgentId),
        db.from('tasks').update({
          status: 'failed',
          lane: 'blocked',
          failed_at: failedAt,
          progress_percent: 0,
          updated_at: failedAt,
        }).eq('id', task.id).eq('user_id', task.user_id),
        db.from('activity_log').insert({
          user_id: task.user_id,
          type: 'ERR',
          message: message.substring(0, 200),
          agent_id: effectiveAgentId,
          tokens: 0,
          duration_ms: Date.now() - startTime,
        }),
      ]);

      errors.push({ taskId: task.id, message });
    } finally {
      busyAgentIds.delete(effectiveAgentId);
    }
  }

  return corsResponse({
    success: true,
    scanned,
    dispatched,
    errors,
    commandersTouched: commanderRows.length,
  });
});
