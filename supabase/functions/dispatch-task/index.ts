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
};

function isTaskComplete(task: TaskGraphRow): boolean {
  return ['completed', 'done'].includes(String(task.status || '').toLowerCase())
    || String(task.workflow_status || '').toLowerCase() === 'completed';
}

function isTaskFailed(task: TaskGraphRow): boolean {
  return ['failed', 'error', 'blocked', 'cancelled'].includes(String(task.status || '').toLowerCase())
    || ['failed', 'blocked', 'cancelled'].includes(String(task.workflow_status || '').toLowerCase());
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
      .select('id,user_id,title,name,description,status,parent_id,root_mission_id,node_type,workflow_status,depends_on,result_text')
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

    if (taskRow) {
      await updateMissionGraphProgress(db, { ...taskRow, status: 'failed', workflow_status: 'failed' });
    }

    await db.from('activity_log').insert({
      user_id: user.id,
      type: 'ERR',
      message: error.message.substring(0, 200),
      agent_id: agent_id,
      tokens: 0,
      duration_ms: latency,
    });

    return corsResponse({ error: error.message }, 500);
  }
});
