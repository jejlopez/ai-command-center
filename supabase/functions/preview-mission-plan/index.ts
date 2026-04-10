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

function fallbackPlan(intent: string, mode = 'balanced') {
  const lower = intent.toLowerCase();
  const steps = [];

  if (/(research|prospect|find|analyze)/.test(lower)) {
    steps.push({ title: 'Gather targets', description: 'Search the requested sources and assemble the working set.' });
  }
  if (/(email|draft|outreach)/.test(lower)) {
    steps.push({ title: 'Draft outbound', description: 'Generate the outreach or message drafts tied to the mission.' });
  }
  if (/(summary|summarize|notes|call|crm|pipedrive)/.test(lower)) {
    steps.push({ title: 'Create clean handoff', description: 'Condense the source material into notes, actions, and structure.' });
  }
  if (/(tracking|shipment|delay|ops|alert)/.test(lower)) {
    steps.push({ title: 'Check live ops', description: 'Inspect the live operational state and isolate exceptions that need action.' });
  }
  if (!steps.length) {
    steps.push({ title: 'Parse mission', description: 'Break the request into an executable mission plan.' });
    steps.push({ title: 'Execute mission', description: 'Run the mission and package the requested output.' });
  }

  const complexity = Math.min(4, Math.max(1, Math.ceil(intent.length / 80)));
  const durationBase = mode === 'fast' ? 4 : mode === 'efficient' ? 8 : 6;
  const estimatedCostCents = (mode === 'fast' ? 45 : mode === 'efficient' ? 16 : 28) * complexity;
  const branches = steps.map((step, index) => ({
    title: step.title,
    description: step.description,
    agentRole: index === 0 ? 'planner' : index === steps.length - 1 ? 'verifier' : 'executor',
    executionStrategy: index === 0 ? 'sequential' : 'parallel',
    branchLabel: index === 0 ? 'Command' : `Branch ${index}`,
    dependsOn: index === 0 ? [] : [steps[0].title],
  }));

  return {
    steps,
    branches,
    estimatedDuration: `${durationBase * complexity}-${durationBase * complexity + 6} min`,
    estimatedCostRange: `$${(estimatedCostCents / 100).toFixed(2)}-$${((estimatedCostCents + 35) / 100).toFixed(2)}`,
    estimatedCostCents,
    source: 'fallback',
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  let body: { intent?: string; mode?: string; outputType?: string; targetType?: string };
  try {
    body = await req.json();
  } catch {
    return corsResponse({ error: 'Invalid JSON body' }, 400);
  }

  if (!body.intent?.trim()) {
    return corsResponse({ error: 'Missing required field: intent' }, 400);
  }

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

  const db = createClient(supabaseUrl, serviceRoleKey);
  const { data: userSettings } = await db
    .from('user_settings')
    .select('anthropic_api_key')
    .eq('user_id', user.id)
    .single();

  if (!userSettings?.anthropic_api_key) {
    return corsResponse(fallbackPlan(body.intent, body.mode), 200);
  }

  try {
    const anthropic = new Anthropic({ apiKey: userSettings.anthropic_api_key });
    const system = `You convert mission requests into compact execution plans.
Return strict JSON only with shape:
{
  "steps":[{"title":"...","description":"..."}],
  "branches":[
    {
      "title":"...",
      "description":"...",
      "agentRole":"planner|researcher|builder|verifier|executor",
      "executionStrategy":"sequential|parallel",
      "branchLabel":"...",
      "dependsOn":["optional branch titles"]
    }
  ],
  "estimatedDuration":"5-12 min",
  "estimatedCostRange":"$0.20-$0.55",
  "estimatedCostCents":35
}
Keep between 3 and 5 short steps.
Use at least one verifier branch for quality-sensitive work.
Use parallel branches only when tasks are independent.`;

    const prompt = `Mission intent: ${body.intent}
Mode: ${body.mode || 'balanced'}
Requested output: ${body.outputType || 'summary'}
Target destination: ${body.targetType || 'internal'}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5',
      system,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 600,
    });

    const text = (response.content[0] as { type: string; text: string }).text;
    const parsed = JSON.parse(text);
    const fallback = fallbackPlan(body.intent, body.mode);
    return corsResponse({
      ...parsed,
      steps: Array.isArray(parsed.steps) ? parsed.steps : fallback.steps,
      branches: Array.isArray(parsed.branches) ? parsed.branches : fallback.branches,
      source: 'planner_endpoint',
    });
  } catch {
    return corsResponse(fallbackPlan(body.intent, body.mode), 200);
  }
});
