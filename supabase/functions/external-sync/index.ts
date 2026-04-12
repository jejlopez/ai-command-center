// Webhook receiver for external services (Pipedrive, trading APIs).
// Currently logs and returns 200 — actual sync logic added when API keys are configured.

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

// Pipedrive deal → deals table mapping (skeleton)
function mapPipedriveDeal(_payload: any): any {
  // When Pipedrive webhook is connected, map fields here:
  // return {
  //   company: payload.current?.org_name ?? payload.current?.title,
  //   contact_name: payload.current?.person_name,
  //   stage: mapPipedriveStage(payload.current?.stage_id),
  //   value_usd: payload.current?.value,
  //   probability: payload.current?.probability,
  //   close_date: payload.current?.expected_close_date,
  //   last_touch: new Date().toISOString(),
  //   notes: `Synced from Pipedrive deal #${payload.current?.id}`,
  // };
  return null;
}

// Pipedrive person → contacts table mapping (skeleton)
function mapPipedrivePerson(_payload: any): any {
  // return {
  //   name: payload.current?.name,
  //   company: payload.current?.org_name,
  //   email: payload.current?.email?.[0]?.value,
  //   phone: payload.current?.phone?.[0]?.value,
  //   last_interaction: new Date().toISOString(),
  // };
  return null;
}

// Trading API → positions table mapping (skeleton)
function mapTradePosition(_payload: any): any {
  // return {
  //   ticker: payload.symbol,
  //   side: payload.side,
  //   entry_price: payload.avg_entry_price,
  //   size: payload.qty,
  //   current_price: payload.current_price,
  //   pnl_usd: payload.unrealized_pl,
  //   status: payload.qty > 0 ? 'open' : 'closed',
  // };
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const url = new URL(req.url);
  const source = url.searchParams.get('source') ?? 'unknown';

  let body: any = {};
  try { body = await req.json(); } catch {}

  console.log(`[external-sync] Received webhook from ${source}:`, JSON.stringify(body).slice(0, 500));

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return corsResponse({ error: 'Missing env vars' }, 500);

  const _supabase = createClient(supabaseUrl, serviceRoleKey);

  switch (source) {
    case 'pipedrive': {
      const event = body.event ?? body.meta?.action;
      console.log(`[external-sync] Pipedrive event: ${event}`);
      if (event === 'updated.deal' || event === 'added.deal') {
        const mapped = mapPipedriveDeal(body);
        if (mapped) console.log('[external-sync] Pipedrive deal mapping ready but not wired');
      }
      if (event === 'updated.person' || event === 'added.person') {
        const mapped = mapPipedrivePerson(body);
        if (mapped) console.log('[external-sync] Pipedrive person mapping ready but not wired');
      }
      return corsResponse({ received: true, source: 'pipedrive', event, synced: false, reason: 'mapping not wired yet' });
    }
    case 'trading': {
      const mapped = mapTradePosition(body);
      if (mapped) console.log('[external-sync] Trading position mapping ready but not wired');
      return corsResponse({ received: true, source: 'trading', synced: false, reason: 'mapping not wired yet' });
    }
    default:
      return corsResponse({ received: true, source, synced: false, reason: `unknown source: ${source}` });
  }
});
