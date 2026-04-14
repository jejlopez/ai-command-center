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

// Pipedrive stage mapping
function mapStage(stageId: number, stageName?: string): string {
  const name = (stageName ?? '').toLowerCase();
  if (name.includes('prospect') || name.includes('lead') || name.includes('new')) return 'prospect';
  if (name.includes('quot') || name.includes('proposal')) return 'quoted';
  if (name.includes('negot') || name.includes('review') || name.includes('pending')) return 'negotiating';
  if (name.includes('won') || name.includes('closed') || name.includes('win')) return 'closed_won';
  if (name.includes('lost') || name.includes('reject')) return 'closed_lost';
  // Default by position: stages 1-2 = prospect, 3-4 = quoted, 5+ = negotiating
  if (stageId <= 2) return 'prospect';
  if (stageId <= 4) return 'quoted';
  return 'negotiating';
}

interface SyncResult {
  resource: string;
  fetched: number;
  upserted: number;
  errors: string[];
}

async function fetchPipedrive(
  domain: string,
  apiToken: string,
  endpoint: string,
  since?: string
): Promise<any[]> {
  const params = new URLSearchParams({
    api_token: apiToken,
    limit: '100',
    sort: 'update_time DESC',
  });
  if (since) {
    params.set('since_timestamp', since);
  }

  const url = `https://${domain}.pipedrive.com/api/v1/${endpoint}?${params}`;
  const res = await fetch(url);

  if (res.status === 429) {
    throw new Error('RATE_LIMITED');
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pipedrive API ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  return json.data ?? [];
}

async function syncDeals(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  domain: string,
  apiToken: string,
  since: string
): Promise<SyncResult> {
  const result: SyncResult = { resource: 'deals', fetched: 0, upserted: 0, errors: [] };

  try {
    const deals = await fetchPipedrive(domain, apiToken, 'deals', since);
    result.fetched = deals.length;

    for (const d of deals) {
      try {
        const mapped: any = {
          user_id: userId,
          pipedrive_id: d.id,
          company: d.org_name ?? d.title ?? `Deal #${d.id}`,
          contact_name: d.person_name ?? null,
          stage: mapStage(d.stage_id, d.stage_order_nr?.toString()),
          value_usd: d.value ?? 0,
          probability: d.probability ?? 50,
          close_date: d.expected_close_date ?? null,
          last_touch: d.update_time ?? new Date().toISOString(),
          notes: d.title ? `${d.title}${d.status ? ` (${d.status})` : ''}` : null,
          updated_at: new Date().toISOString(),
        };

        // Check if deal is won/lost
        if (d.status === 'won') mapped.stage = 'closed_won';
        if (d.status === 'lost') {
          mapped.stage = 'closed_lost';
          mapped.notes = `${mapped.notes ?? ''} — Lost: ${d.lost_reason ?? 'unknown'}`.trim();
        }

        const { error } = await supabase
          .from('deals')
          .upsert(mapped, { onConflict: 'user_id,pipedrive_id' });

        if (error) {
          result.errors.push(`deal ${d.id}: ${error.message}`);
        } else {
          result.upserted++;
        }
      } catch (e: any) {
        result.errors.push(`deal ${d.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    if (e.message === 'RATE_LIMITED') throw e;
    result.errors.push(e.message);
  }

  return result;
}

async function syncPersons(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  domain: string,
  apiToken: string,
  since: string
): Promise<SyncResult> {
  const result: SyncResult = { resource: 'persons', fetched: 0, upserted: 0, errors: [] };

  try {
    const persons = await fetchPipedrive(domain, apiToken, 'persons', since);
    result.fetched = persons.length;

    for (const p of persons) {
      try {
        const email = Array.isArray(p.email) ? p.email.find((e: any) => e.primary)?.value ?? p.email[0]?.value : p.email;
        const phone = Array.isArray(p.phone) ? p.phone.find((ph: any) => ph.primary)?.value ?? p.phone[0]?.value : p.phone;

        const mapped = {
          user_id: userId,
          pipedrive_id: p.id,
          name: p.name ?? `Person #${p.id}`,
          company: p.org_name ?? null,
          role: p.job_title ?? null,
          email: email ?? null,
          phone: phone ?? null,
          last_interaction: p.update_time ?? null,
          notes: p.notes ?? null,
        };

        const { error } = await supabase
          .from('contacts')
          .upsert(mapped, { onConflict: 'user_id,pipedrive_id' });

        if (error) {
          result.errors.push(`person ${p.id}: ${error.message}`);
        } else {
          result.upserted++;
        }
      } catch (e: any) {
        result.errors.push(`person ${p.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    if (e.message === 'RATE_LIMITED') throw e;
    result.errors.push(e.message);
  }

  return result;
}

async function syncActivities(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  domain: string,
  apiToken: string,
  since: string
): Promise<SyncResult> {
  const result: SyncResult = { resource: 'activities', fetched: 0, upserted: 0, errors: [] };

  try {
    const activities = await fetchPipedrive(domain, apiToken, 'activities', since);
    result.fetched = activities.length;

    for (const a of activities) {
      try {
        // Map activities to follow_ups
        if (a.done === false || a.done === 0) {
          const mapped: any = {
            user_id: userId,
            pipedrive_id: a.id,
            action: a.subject ?? a.type ?? `Activity #${a.id}`,
            due_date: a.due_date ?? new Date().toISOString().slice(0, 10),
            status: 'pending',
            priority: a.type === 'call' ? 'high' : 'normal',
            notes: a.note ?? null,
          };

          // Try to link to a deal
          if (a.deal_id) {
            const { data: deal } = await supabase
              .from('deals')
              .select('id')
              .eq('user_id', userId)
              .eq('pipedrive_id', a.deal_id)
              .maybeSingle();
            if (deal) mapped.deal_id = deal.id;
          }

          const { error } = await supabase
            .from('follow_ups')
            .upsert(mapped, { onConflict: 'user_id,pipedrive_id' });

          if (error) {
            result.errors.push(`activity ${a.id}: ${error.message}`);
          } else {
            result.upserted++;
          }
        }
      } catch (e: any) {
        result.errors.push(`activity ${a.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    if (e.message === 'RATE_LIMITED') throw e;
    result.errors.push(e.message);
  }

  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return corsResponse({ error: 'Missing env vars' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    // Get all users that have Pipedrive configured
    const { data: creds } = await supabase
      .from('provider_credentials')
      .select('user_id, credentials')
      .eq('provider', 'pipedrive')
      .not('credentials', 'is', null);

    if (!creds || creds.length === 0) {
      return corsResponse({ skipped: true, reason: 'No Pipedrive credentials configured' });
    }

    const now = new Date();
    const allResults: Record<string, any> = {};

    for (const cred of creds) {
      const userId = cred.user_id;
      const config = typeof cred.credentials === 'string' ? JSON.parse(cred.credentials) : cred.credentials;
      const apiToken = config?.api_token ?? config?.api_key;
      const domain = config?.domain ?? 'api';

      if (!apiToken) {
        allResults[userId] = { error: 'No API token found' };
        continue;
      }

      // Check circuit breaker
      const { data: states } = await supabase
        .from('sync_state')
        .select('*')
        .eq('user_id', userId)
        .eq('provider', 'pipedrive');

      const stateMap: Record<string, any> = {};
      for (const s of (states ?? [])) stateMap[s.resource] = s;

      // Smart scheduling: check if it's business hours (rough ET offset)
      const hour = now.getUTCHours() - 4;
      const isBusinessHours = hour >= 8 && hour <= 18;
      const isWeekend = now.getUTCDay() === 0 || now.getUTCDay() === 6;

      // After hours: only sync if last sync was 30+ min ago
      // Weekends: only sync if last sync was 60+ min ago
      const minInterval = isWeekend ? 60 : isBusinessHours ? 5 : 30;

      const results: SyncResult[] = [];

      for (const resource of ['deals', 'persons', 'activities']) {
        const state = stateMap[resource];

        // Circuit breaker: skip if in backoff
        if (state?.backoff_until && new Date(state.backoff_until) > now) {
          results.push({ resource, fetched: 0, upserted: 0, errors: [`Backed off until ${state.backoff_until}`] });
          continue;
        }

        // Smart interval: skip if synced too recently
        if (state?.last_sync) {
          const minsSince = (now.getTime() - new Date(state.last_sync).getTime()) / 60000;
          if (minsSince < minInterval) {
            results.push({ resource, fetched: 0, upserted: 0, errors: [`Skipped — last sync ${Math.round(minsSince)}m ago (min: ${minInterval}m)`] });
            continue;
          }
        }

        const since = state?.last_sync ?? '2000-01-01T00:00:00Z';

        try {
          let syncResult: SyncResult;
          if (resource === 'deals') {
            syncResult = await syncDeals(supabase, userId, domain, apiToken, since);
          } else if (resource === 'persons') {
            syncResult = await syncPersons(supabase, userId, domain, apiToken, since);
          } else {
            syncResult = await syncActivities(supabase, userId, domain, apiToken, since);
          }

          results.push(syncResult);

          // Update sync state
          await supabase.from('sync_state').upsert({
            user_id: userId,
            provider: 'pipedrive',
            resource,
            last_sync: now.toISOString(),
            last_status: syncResult.errors.length > 0 ? 'error' : 'ok',
            error_msg: syncResult.errors.length > 0 ? syncResult.errors.join('; ') : null,
            backoff_until: null, // clear backoff on success
          }, { onConflict: 'user_id,provider,resource' });

        } catch (e: any) {
          if (e.message === 'RATE_LIMITED') {
            // Circuit breaker: exponential backoff
            const currentBackoff = state?.backoff_until ? new Date(state.backoff_until) : null;
            const backoffMinutes = currentBackoff ? Math.min(120, minInterval * 4) : minInterval * 2;
            const backoffUntil = new Date(now.getTime() + backoffMinutes * 60000);

            await supabase.from('sync_state').upsert({
              user_id: userId,
              provider: 'pipedrive',
              resource,
              last_sync: state?.last_sync ?? now.toISOString(),
              last_status: 'rate_limited',
              error_msg: `Rate limited — backing off ${backoffMinutes}m`,
              backoff_until: backoffUntil.toISOString(),
            }, { onConflict: 'user_id,provider,resource' });

            results.push({ resource, fetched: 0, upserted: 0, errors: [`Rate limited — backing off ${backoffMinutes}m`] });
          } else {
            results.push({ resource, fetched: 0, upserted: 0, errors: [e.message] });
          }
        }
      }

      allResults[userId] = {
        domain,
        businessHours: isBusinessHours,
        interval: `${minInterval}m`,
        results,
      };
    }

    return corsResponse({ synced_at: now.toISOString(), users: allResults });

  } catch (e: any) {
    return corsResponse({ error: e.message }, 500);
  }
});
