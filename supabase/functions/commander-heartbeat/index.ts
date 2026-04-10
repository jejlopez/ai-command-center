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
  sessionId: string | null | undefined,
  workerAgentId: string | null | undefined,
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

function getProviderCredential(userSettings: Record<string, string | null>, provider: Provider): string {
  if (provider === 'anthropic') return userSettings.anthropic_api_key || '';
  if (provider === 'openai') return userSettings.openai_api_key || '';
  if (provider === 'google') return userSettings.google_api_key || '';
  return '';
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
    return {
      text: (aiResponse.content[0] as { type: string; text: string }).text,
      tokens: aiResponse.usage.input_tokens + aiResponse.usage.output_tokens,
    };
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

    return {
      text: extractTextFromOpenAIResponse(payload as Record<string, unknown>),
      tokens: Number(((payload as Record<string, unknown>).usage as Record<string, unknown> | undefined)?.total_tokens || 0),
    };
  }

  if (provider === 'google') {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: systemPrompt
          ? { parts: [{ text: systemPrompt }] }
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

    return {
      text: extractTextFromGoogleResponse(payload as Record<string, unknown>),
      tokens: Number(((payload as Record<string, unknown>).usageMetadata as Record<string, unknown> | undefined)?.totalTokenCount || 0),
    };
  }

  throw new Error(`Unsupported provider: ${provider}`);
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
  session_id?: string | null;
  template_id?: string | null;
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
      .select('id,user_id,name,title,description,status,agent_id,created_by_commander_id,priority,progress_percent,run_at,started_at,created_at,session_id,template_id')
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
  const userSettingsCache = new Map<string, { anthropic_api_key: string | null; openai_api_key: string | null; google_api_key: string | null }>();
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

    const provider = inferProvider(agent.model);
    const executionModel = normalizeExecutionModel(agent.model, provider);
    if (provider === 'custom') {
      if (task.session_id) {
        await db.from('agent_sessions').update({
          status: 'failed',
          summary: `Unsupported execution model: ${agent.model}`,
          completed_at: new Date().toISOString(),
        }).eq('id', task.session_id).eq('user_id', task.user_id);
        await writeSessionEvent(db, task.user_id, task.session_id, effectiveAgentId, {
          eventType: 'error',
          title: 'Unsupported model',
          content: `${agent.model} is not yet supported by the heartbeat runtime.`,
          status: 'failed',
          payload: { task_id: task.id, template_id: task.template_id, provider },
        });
      }
      errors.push({ taskId: task.id, message: `Unsupported model ${agent.model}` });
      continue;
    }

    let userSettings = userSettingsCache.get(task.user_id);
    if (!userSettings) {
      const { data: settingsRow, error: settingsError } = await db
        .from('user_settings')
        .select('anthropic_api_key, openai_api_key, google_api_key')
        .eq('user_id', task.user_id)
        .single();

      const providerApiKey = settingsError ? '' : getProviderCredential(settingsRow as Record<string, string | null>, provider);
      if (settingsError || !providerApiKey) {
        const message = settingsError?.message || `Missing ${providerLabel(provider)} API key`;
        if (task.session_id) {
          await db.from('agent_sessions').update({
            status: 'failed',
            summary: message,
            completed_at: new Date().toISOString(),
          }).eq('id', task.session_id).eq('user_id', task.user_id);
          await writeSessionEvent(db, task.user_id, task.session_id, effectiveAgentId, {
            eventType: 'error',
            title: 'Missing credentials',
            content: `${providerLabel(provider)} is not connected. Add the API key in Settings -> Connected Systems.`,
            status: 'failed',
            payload: { provider, task_id: task.id },
          });
        }
        errors.push({ taskId: task.id, message });
        continue;
      }

      userSettings = settingsRow as { anthropic_api_key: string | null; openai_api_key: string | null; google_api_key: string | null };
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
    if (task.session_id) {
      await db.from('agent_sessions').update({
        status: 'running',
        worker_agent_id: effectiveAgentId,
        started_at: claimAt,
        summary: 'Execution in progress',
      }).eq('id', task.session_id).eq('user_id', task.user_id);
      await writeSessionEvent(db, task.user_id, task.session_id, effectiveAgentId, {
        eventType: 'tool_call',
        title: 'commander-heartbeat',
        content: 'Commander claimed and launched the queued session task.',
        status: 'running',
        payload: { task_id: task.id, model: executionModel, provider, template_id: task.template_id },
      });
    }

    const prompt = task.description || task.title || task.name || 'Execute queued mission';
    const startTime = Date.now();

    try {
      const { text: responseText, tokens } = await executeModel({
        provider,
        apiKey: getProviderCredential(userSettings || {}, provider),
        model: executionModel,
        systemPrompt: agent.system_prompt || '',
        prompt,
        temperature: parseFloat(String(agent.temperature ?? 0.7)) || 0.7,
        maxTokens: MAX_TOKENS_MAP[agent.response_length || 'medium'] ?? 2048,
      });
      const latency = Date.now() - startTime;
      const cost = tokens * costPerToken(provider, executionModel);
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
          session_id: task.session_id || null,
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
          session_id: task.session_id || null,
        }),
      ]);

      if (task.session_id) {
        await db.from('agent_sessions').update({
          status: 'needs_review',
          summary: responseText.substring(0, 240),
          total_tokens: tokens,
          total_cost: cost,
          tool_call_count: 1,
          completed_at: completedAt,
        }).eq('id', task.session_id).eq('user_id', task.user_id);
        await Promise.all([
          writeSessionEvent(db, task.user_id, task.session_id, effectiveAgentId, {
            eventType: 'tool_result',
            title: 'Model response received',
            content: responseText.substring(0, 400),
            status: 'completed',
            payload: { task_id: task.id, template_id: task.template_id, provider, model: executionModel },
            durationMs: latency,
            tokenDelta: tokens,
            costDelta: cost,
          }),
          writeSessionEvent(db, task.user_id, task.session_id, effectiveAgentId, {
            eventType: 'approval_requested',
            title: 'Approval requested',
            content: 'Output was written to the review queue and needs commander approval.',
            status: 'needs_review',
            payload: { review_id: reviewId },
          }),
        ]);
      }

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
          session_id: task.session_id || null,
          tokens: 0,
          duration_ms: Date.now() - startTime,
        }),
      ]);

      if (task.session_id) {
        await db.from('agent_sessions').update({
          status: 'failed',
          summary: message.substring(0, 240),
          completed_at: failedAt,
        }).eq('id', task.session_id).eq('user_id', task.user_id);
        await writeSessionEvent(db, task.user_id, task.session_id, effectiveAgentId, {
          eventType: 'error',
          title: 'Execution failed',
          content: message.substring(0, 400),
          status: 'failed',
          payload: { task_id: task.id, template_id: task.template_id },
          durationMs: Date.now() - startTime,
        });
      }

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
