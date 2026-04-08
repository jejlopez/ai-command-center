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

  let body: { agent_id?: string; task_description?: string };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { agent_id, task_description } = body;
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

  if (!agent.model?.startsWith('claude-')) {
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

  // ── Call Anthropic ───────────────────────────────────────────────────────

  const startTime = Date.now();

  try {
    const anthropic = new Anthropic({ apiKey: userSettings.anthropic_api_key });

    const aiResponse = await anthropic.messages.create({
      model: agent.model,
      system: agent.system_prompt || '',
      messages: [{ role: 'user', content: task_description }],
      temperature: parseFloat(agent.temperature) ?? 0.7,
      max_tokens: MAX_TOKENS_MAP[agent.response_length as string] ?? 2048,
    });

    const latency = Date.now() - startTime;
    const responseText = (aiResponse.content[0] as { type: string; text: string }).text;
    const tokens = aiResponse.usage.input_tokens + aiResponse.usage.output_tokens;
    const cost = tokens * costPerToken(agent.model);

    const taskId = crypto.randomUUID();
    const reviewId = crypto.randomUUID();

    await Promise.all([
      db.from('agents').update({
        status: 'idle',
        latency_ms: latency,
        total_tokens: (agent.total_tokens ?? 0) + tokens,
        total_cost: parseFloat(agent.total_cost ?? 0) + cost,
        task_count: (agent.task_count ?? 0) + 1,
      }).eq('id', agent_id),

      db.from('tasks').insert({
        id: taskId,
        user_id: user.id,
        name: task_description.substring(0, 120),
        status: 'completed',
        agent_id: agent.id,
        agent_name: agent.name,
        duration_ms: latency,
        cost_usd: cost,
        prompt_text: task_description,
        result_text: responseText,
        completed_at: new Date().toISOString(),
      }),

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
