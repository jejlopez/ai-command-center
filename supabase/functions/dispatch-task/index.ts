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

type Provider = 'anthropic' | 'openai' | 'google' | 'custom';

async function nextSessionSequence(db: ReturnType<typeof createClient>, sessionId: string): Promise<number> {
  const { data } = await db
    .from('session_events')
    .select('sequence')
    .eq('session_id', sessionId)
    .order('sequence', { ascending: false })
    .limit(1)
    .maybeSingle();

  return Number(data?.sequence ?? -1) + 1;
}

async function writeSessionEvent(
  db: ReturnType<typeof createClient>,
  userId: string,
  sessionId: string | undefined,
  workerAgentId: string | undefined,
  event: {
    eventType: string;
    title: string;
    content?: string;
    status?: string;
    payload?: Record<string, unknown>;
    durationMs?: number;
    tokenDelta?: number;
    costDelta?: number;
  },
) {
  if (!sessionId) return;

  const sequence = await nextSessionSequence(db, sessionId);
  await db.from('session_events').insert({
    user_id: userId,
    session_id: sessionId,
    worker_agent_id: workerAgentId ?? null,
    event_type: event.eventType,
    title: event.title,
    content: event.content || '',
    status: event.status || null,
    payload: event.payload || {},
    sequence,
    duration_ms: event.durationMs || 0,
    token_delta: event.tokenDelta || 0,
    cost_delta: event.costDelta || 0,
  });
}

// ── Cost per token by model family ────────────────────────────────────────────

function inferProvider(model: string): Provider {
  const normalized = String(model || '').trim().toLowerCase();
  if (!normalized) return 'custom';
  if (normalized.includes('claude')) return 'anthropic';
  if (normalized.includes('gpt') || normalized.includes('o1') || normalized.includes('o3') || normalized.includes('o4')) return 'openai';
  if (normalized.includes('gemini')) return 'google';
  return 'custom';
}

function providerLabel(provider: Provider): string {
  if (provider === 'anthropic') return 'Anthropic';
  if (provider === 'openai') return 'OpenAI';
  if (provider === 'google') return 'Google';
  return 'Custom';
}

function costPerToken(provider: Provider, model: string): number {
  if (provider === 'anthropic') {
    if (model.startsWith('claude-opus-')) return 0.000075;
    if (model.startsWith('claude-sonnet-')) return 0.000015;
    return 0.000003;
  }
  if (provider === 'openai') {
    if (model.startsWith('gpt-5')) return 0.00002;
    if (model.startsWith('o3') || model.startsWith('o4')) return 0.00003;
    return 0.00001;
  }
  if (provider === 'google') {
    if (model.startsWith('gemini-2.5-pro')) return 0.00001;
    return 0.000005;
  }
  return 0.00001;
}

function normalizeExecutionModel(model: string, provider: Provider): string {
  const normalized = String(model || '').trim().toLowerCase();

  if (!normalized) return '';
  if (provider === 'anthropic') {
    if (normalized.startsWith('claude-')) return normalized;
    const aliases: Record<string, string> = {
      'claude opus 4.6': 'claude-opus-4-6',
      'claude sonnet 4.6': 'claude-sonnet-4-6',
      'claude sonnet 4.5': 'claude-sonnet-4-5',
    };
    return aliases[normalized] || normalized.replace(/\s+/g, '-');
  }
  if (provider === 'openai') {
    return normalized
      .replace(/\s+/g, '-')
      .replace(/gpt[- ]?5\.4/g, 'gpt-5.4')
      .replace(/gpt[- ]?5/g, 'gpt-5')
      .replace(/o3[- ]?mini/g, 'o3-mini')
      .replace(/o4[- ]?mini/g, 'o4-mini');
  }
  if (provider === 'google') {
    return normalized.replace(/\s+/g, '-');
  }
  return normalized.replace(/\s+/g, '-');
}

function getProviderCredential(userSettings: Record<string, string | null>, provider: Provider): string {
  if (provider === 'anthropic') return userSettings.anthropic_api_key || '';
  if (provider === 'openai') return userSettings.openai_api_key || '';
  if (provider === 'google') return userSettings.google_api_key || '';
  return '';
}

function extractTextFromOpenAIResponse(payload: Record<string, unknown>): string {
  const choices = Array.isArray(payload.choices) ? payload.choices as Array<Record<string, unknown>> : [];
  const content = choices[0]?.message as Record<string, unknown> | undefined;
  const raw = content?.content;
  if (typeof raw === 'string') return raw;
  if (Array.isArray(raw)) {
    return raw
      .map((item) => (typeof item === 'string' ? item : (item as Record<string, unknown>)?.text))
      .filter(Boolean)
      .join('\n');
  }
  return '';
}

function extractTextFromGoogleResponse(payload: Record<string, unknown>): string {
  const candidates = Array.isArray(payload.candidates) ? payload.candidates as Array<Record<string, unknown>> : [];
  const parts = (((candidates[0]?.content as Record<string, unknown> | undefined)?.parts) || []) as Array<Record<string, unknown>>;
  return parts.map((part) => String(part.text || '')).join('\n').trim();
}

async function executeModel(params: {
  provider: Provider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
}): Promise<{ text: string; tokens: number }> {
  const { provider, apiKey, model, systemPrompt, prompt, temperature, maxTokens } = params;

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey });
    const aiResponse = await anthropic.messages.create({
      model,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
      temperature,
      max_tokens: maxTokens,
    });

    const text = (aiResponse.content[0] as { type: string; text: string }).text;
    const tokens = aiResponse.usage.input_tokens + aiResponse.usage.output_tokens;
    return { text, tokens };
  }

  if (provider === 'openai') {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt || '' },
          { role: 'user', content: prompt },
        ],
        temperature,
        max_completion_tokens: maxTokens,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String((payload as Record<string, unknown>)?.error?.message || `OpenAI HTTP ${response.status}`));
    }

    const text = extractTextFromOpenAIResponse(payload as Record<string, unknown>);
    const usage = (payload as Record<string, unknown>).usage as Record<string, unknown> | undefined;
    const tokens = Number(usage?.total_tokens || 0);
    return { text, tokens };
  }

  if (provider === 'google') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: systemPrompt
          ? {
              parts: [{ text: systemPrompt }],
            }
          : undefined,
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(String((payload as Record<string, unknown>)?.error?.message || `Google HTTP ${response.status}`));
    }

    const text = extractTextFromGoogleResponse(payload as Record<string, unknown>);
    const usage = (payload as Record<string, unknown>).usageMetadata as Record<string, unknown> | undefined;
    const tokens = Number(usage?.totalTokenCount || 0);
    return { text, tokens };
  }

  throw new Error(`Unsupported provider: ${provider}`);
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

  let body: { agent_id?: string; task_description?: string; task_id?: string; session_id?: string; template_id?: string };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'Invalid JSON body' }, 400);
  }

  const { agent_id, task_description, task_id, session_id, template_id } = body;
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

  const provider = inferProvider(agent.model);
  const executionModel = normalizeExecutionModel(agent.model, provider);

  if (provider === 'custom') {
    if (task_id) {
      await db.from('tasks').update({
        status: 'failed',
        lane: 'blocked',
        failed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq('id', task_id).eq('user_id', user.id);
    }
    if (session_id) {
      await db.from('agent_sessions').update({
        status: 'failed',
        summary: `Unsupported execution model: ${agent.model}`,
        completed_at: new Date().toISOString(),
      }).eq('id', session_id).eq('user_id', user.id);
      await writeSessionEvent(db, user.id, session_id, agent.id, {
        eventType: 'error',
        title: 'Unsupported model',
        content: `${agent.model} is not yet supported by the current runtime.`,
        status: 'failed',
        payload: { model: agent.model, provider, template_id },
      });
    }
    return corsResponse({ error: 'Model not yet supported in Phase 1' }, 422);
  }

  // ── Fetch user's provider API keys ───────────────────────────────────────

  const { data: userSettings } = await db
    .from('user_settings')
    .select('anthropic_api_key, openai_api_key, google_api_key')
    .eq('user_id', user.id)
    .single();

  const providerApiKey = getProviderCredential(userSettings || {}, provider);

  if (!providerApiKey) {
    if (session_id) {
      await db.from('agent_sessions').update({
        status: 'failed',
        summary: `Missing ${providerLabel(provider)} API key`,
        completed_at: new Date().toISOString(),
      }).eq('id', session_id).eq('user_id', user.id);
      await writeSessionEvent(db, user.id, session_id, agent.id, {
        eventType: 'error',
        title: 'Missing credentials',
        content: `No ${providerLabel(provider)} API key set. Add it in Settings -> Connected Systems.`,
        status: 'failed',
        payload: { provider },
      });
    }
    return corsResponse({ error: `No ${providerLabel(provider)} API key set. Add it in Settings -> Connected Systems.` }, 400);
  }

  // ── Mark processing ──────────────────────────────────────────────────────

  await db.from('agents').update({ status: 'processing' }).eq('id', agent_id);

  if (task_id) {
    await db.from('tasks').update({
      status: 'running',
      lane: 'active',
      started_at: new Date().toISOString(),
      progress_percent: 15,
      updated_at: new Date().toISOString(),
    }).eq('id', task_id).eq('user_id', user.id);
  }
  if (session_id) {
    await db.from('agent_sessions').update({
      status: 'running',
      started_at: new Date().toISOString(),
      worker_agent_id: agent.id,
      root_agent_id: agent.parent_id || null,
      summary: 'Execution in progress',
    }).eq('id', session_id).eq('user_id', user.id);

    await writeSessionEvent(db, user.id, session_id, agent.id, {
      eventType: 'tool_call',
      title: 'dispatch-task',
      content: 'Managed runtime invoked the task executor.',
      status: 'running',
      payload: { model: executionModel, provider, template_id, task_id },
    });
  }

  // ── Call model provider ──────────────────────────────────────────────────

  const startTime = Date.now();

  try {
    const { text: responseText, tokens } = await executeModel({
      provider,
      apiKey: providerApiKey,
      model: executionModel,
      systemPrompt: agent.system_prompt || '',
      prompt: task_description,
      temperature: parseFloat(agent.temperature) ?? 0.7,
      maxTokens: MAX_TOKENS_MAP[agent.response_length as string] ?? 2048,
    });
    const latency = Date.now() - startTime;
    const cost = tokens * costPerToken(provider, executionModel);

    const taskId = task_id || crypto.randomUUID();
    const reviewId = crypto.randomUUID();
    const completedAt = new Date().toISOString();
    const taskWrite = task_id
      ? db.from('tasks').update({
        status: 'completed',
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
        agent_id: agent.id,
        agent_name: agent.name,
        duration_ms: latency,
        cost_usd: cost,
        prompt_text: task_description,
        result_text: responseText,
        completed_at: completedAt,
        session_id: session_id || null,
        template_id: template_id || null,
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
        session_id: session_id || null,
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
        session_id: session_id || null,
      }),
    ]);

    if (session_id) {
      await db.from('agent_sessions').update({
        status: 'needs_review',
        summary: responseText.substring(0, 240),
        total_tokens: tokens,
        total_cost: cost,
        tool_call_count: 1,
        completed_at: completedAt,
      }).eq('id', session_id).eq('user_id', user.id);

      await Promise.all([
        writeSessionEvent(db, user.id, session_id, agent.id, {
          eventType: 'tool_result',
          title: 'Model response received',
          content: responseText.substring(0, 400),
          status: 'completed',
          payload: { model: executionModel, provider, task_id, template_id },
          durationMs: latency,
          tokenDelta: tokens,
          costDelta: cost,
        }),
        writeSessionEvent(db, user.id, session_id, agent.id, {
          eventType: 'approval_requested',
          title: 'Approval requested',
          content: 'Output was written to the review queue and needs commander approval.',
          status: 'needs_review',
          payload: { review_id: reviewId },
        }),
      ]);
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
        lane: 'blocked',
        failed_at: new Date().toISOString(),
        progress_percent: 0,
        updated_at: new Date().toISOString(),
      }).eq('id', task_id).eq('user_id', user.id);
    }

    await db.from('activity_log').insert({
      user_id: user.id,
      type: 'ERR',
      message: error.message.substring(0, 200),
      agent_id: agent_id,
      session_id: session_id || null,
      tokens: 0,
      duration_ms: latency,
    });

    if (session_id) {
      await db.from('agent_sessions').update({
        status: 'failed',
        summary: error.message.substring(0, 240),
        completed_at: new Date().toISOString(),
      }).eq('id', session_id).eq('user_id', user.id);

      await writeSessionEvent(db, user.id, session_id, agent.id, {
        eventType: 'error',
        title: 'Execution failed',
        content: error.message.substring(0, 400),
        status: 'failed',
        payload: { task_id, template_id },
        durationMs: latency,
      });
    }

    return corsResponse({ error: error.message }, 500);
  }
});
