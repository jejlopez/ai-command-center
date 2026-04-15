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

// Keep the real Pipedrive stage name — the UI handles display
function mapStage(stageId: number, stageName?: string): string {
  if (stageName) return stageName;
  return `Stage ${stageId}`;
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

async function fetchStageMap(domain: string, apiToken: string): Promise<Record<number, string>> {
  const map: Record<number, string> = {};
  try {
    const url = `https://${domain}.pipedrive.com/api/v1/stages?api_token=${apiToken}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      for (const s of (json.data ?? [])) {
        map[s.id] = s.name;
      }
    }
  } catch {}
  return map;
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
    // Fetch stage names first so we can map stage_id → real name
    const stageMap = await fetchStageMap(domain, apiToken);

    const deals = await fetchPipedrive(domain, apiToken, 'deals', since);
    result.fetched = deals.length;

    // Lead-stage names — these go to `leads` table, not `deals`
    const LEAD_STAGES = ['new lead', 'new leads', 'pipedrive leads', 'gather info'];

    function isLeadStage(stageName: string): boolean {
      const lower = (stageName ?? '').toLowerCase();
      return LEAD_STAGES.some(ls => lower.includes(ls));
    }

    for (const d of deals) {
      try {
        // Link to contacts table if person exists
        let contactId = null;
        if (d.person_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', userId)
            .eq('pipedrive_id', d.person_id)
            .maybeSingle();
          if (contact) contactId = contact.id;
        }

        const stageName = d.stage_name ?? stageMap[d.stage_id] ?? mapStage(d.stage_id, d.stage_order_nr?.toString());

        // Route to leads table if it's a lead stage
        if (isLeadStage(stageName) && d.status !== 'won' && d.status !== 'lost') {
          const leadMapped: any = {
            user_id: userId,
            pipedrive_id: d.id,
            company: d.org_name ?? d.title ?? `Lead #${d.id}`,
            contact_id: contactId,
            source: 'pipedrive',
            status: 'new',
            notes: d.title ?? null,
            updated_at: new Date().toISOString(),
          };

          const { error } = await supabase
            .from('leads')
            .upsert(leadMapped, { onConflict: 'user_id,pipedrive_id' });

          if (error) {
            result.errors.push(`lead-deal ${d.id}: ${error.message}`);
          } else {
            result.upserted++;
          }
          continue; // skip deals table for this record
        }

        // Real deal — goes to deals table
        const mapped: any = {
          user_id: userId,
          pipedrive_id: d.id,
          company: d.org_name ?? d.title ?? `Deal #${d.id}`,
          contact_name: d.person_name ?? null,
          contact_id: contactId,
          stage: stageName,
          value_usd: d.value ?? 0,
          probability: d.probability ?? 50,
          close_date: d.expected_close_date ?? null,
          last_touch: d.update_time ?? new Date().toISOString(),
          notes: [d.title, d.status ? `(${d.status})` : null, d.lost_reason ? `Lost: ${d.lost_reason}` : null].filter(Boolean).join(' — '),
          updated_at: new Date().toISOString(),
        };

        // Check if deal is won/lost
        if (d.status === 'won') mapped.stage = 'closed_won';
        if (d.status === 'lost') mapped.stage = 'closed_lost';

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

        // Write to activities table (unified timeline)
        {
          let actDealId = null;
          let actContactId = null;
          if (a.deal_id) {
            const { data: deal } = await supabase.from('deals').select('id').eq('user_id', userId).eq('pipedrive_id', a.deal_id).maybeSingle();
            if (deal) actDealId = deal.id;
          }
          if (a.person_id) {
            const { data: contact } = await supabase.from('contacts').select('id').eq('user_id', userId).eq('pipedrive_id', a.person_id).maybeSingle();
            if (contact) actContactId = contact.id;
          }

          const actType = a.type === 'call' ? 'call' : a.type === 'meeting' ? 'meeting' : a.type === 'email' ? (a.done ? 'email_sent' : 'email_received') : 'note';
          const actDate = a.due_date ? `${a.due_date}T${a.due_time ?? '00:00'}:00Z` : a.update_time ?? a.add_time;
          const actBody = [a.note, a.public_description].filter(Boolean).join('\n').replace(/<[^>]*>/g, '').trim();

          // Dedup by source + occurred_at + subject
          const { data: existAct } = await supabase.from('activities').select('id').eq('user_id', userId).eq('source', 'pipedrive').eq('occurred_at', actDate).eq('subject', a.subject ?? '').limit(1);

          if (!existAct || existAct.length === 0) {
            await supabase.from('activities').insert({
              user_id: userId,
              deal_id: actDealId,
              contact_id: actContactId,
              type: actType,
              subject: a.subject ?? null,
              body: actBody || null,
              metadata: { pipedrive_id: a.id, done: a.done, duration: a.duration },
              source: 'pipedrive',
              occurred_at: actDate,
            });
          }
        }

        // Also store activity details as communications if they have notes
        if (a.note || a.public_description) {
          const commBody = [a.note, a.public_description].filter(Boolean).join('\n').replace(/<[^>]*>/g, '').trim();
          if (commBody) {
            let commDealId = null;
            if (a.deal_id) {
              const { data: deal } = await supabase
                .from('deals')
                .select('id')
                .eq('user_id', userId)
                .eq('pipedrive_id', a.deal_id)
                .maybeSingle();
              if (deal) commDealId = deal.id;
            }

            let commContactId = null;
            if (a.person_id) {
              const { data: contact } = await supabase
                .from('contacts')
                .select('id')
                .eq('user_id', userId)
                .eq('pipedrive_id', a.person_id)
                .maybeSingle();
              if (contact) commContactId = contact.id;
            }

            // Dedup check
            const activityDate = a.due_date ? `${a.due_date}T${a.due_time ?? '00:00'}:00Z` : a.update_time ?? a.add_time;
            const { data: existingComm } = await supabase
              .from('communications')
              .select('id')
              .eq('user_id', userId)
              .eq('type', a.type ?? 'activity')
              .eq('occurred_at', activityDate)
              .limit(1);

            if (!existingComm || existingComm.length === 0) {
              await supabase.from('communications').insert({
                user_id: userId,
                deal_id: commDealId,
                contact_id: commContactId,
                type: a.type ?? 'activity',
                subject: a.subject ?? null,
                body: commBody,
                occurred_at: activityDate,
              });
            }
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

async function syncNotes(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  domain: string,
  apiToken: string,
  since: string
): Promise<SyncResult> {
  const result: SyncResult = { resource: 'notes', fetched: 0, upserted: 0, errors: [] };

  try {
    const params = new URLSearchParams({
      api_token: apiToken,
      limit: '100',
      sort: 'update_time DESC',
      start: '0',
    });
    if (since !== '2000-01-01T00:00:00Z') {
      params.set('since_timestamp', since);
    }

    const url = `https://${domain}.pipedrive.com/api/v1/notes?${params}`;
    const res = await fetch(url);
    if (res.status === 429) throw new Error('RATE_LIMITED');
    if (!res.ok) throw new Error(`Pipedrive notes API ${res.status}`);

    const json = await res.json();
    const notes = json.data ?? [];
    result.fetched = notes.length;

    for (const n of notes) {
      try {
        // Find linked deal in our DB
        let dealId = null;
        if (n.deal_id) {
          const { data: deal } = await supabase
            .from('deals')
            .select('id')
            .eq('user_id', userId)
            .eq('pipedrive_id', n.deal_id)
            .maybeSingle();
          if (deal) dealId = deal.id;
        }

        // Find linked contact
        let contactId = null;
        if (n.person_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id')
            .eq('user_id', userId)
            .eq('pipedrive_id', n.person_id)
            .maybeSingle();
          if (contact) contactId = contact.id;
        }

        // Strip HTML from note content
        const body = (n.content ?? '').replace(/<[^>]*>/g, '').trim();
        if (!body) continue;

        const mapped = {
          user_id: userId,
          deal_id: dealId,
          contact_id: contactId,
          type: 'note',
          subject: n.org_name ?? n.person_name ?? null,
          body: body,
          occurred_at: n.update_time ?? n.add_time ?? new Date().toISOString(),
        };

        // Dedup: check if we already have this note by user_id + type + occurred_at
        const { data: existing } = await supabase
          .from('communications')
          .select('id')
          .eq('user_id', userId)
          .eq('type', 'note')
          .eq('occurred_at', mapped.occurred_at)
          .limit(1);

        if (existing && existing.length > 0) continue;

        const { error } = await supabase.from('communications').insert(mapped);
        if (error) {
          result.errors.push(`note ${n.id}: ${error.message}`);
        } else {
          result.upserted++;
        }
      } catch (e: any) {
        result.errors.push(`note ${n.id}: ${e.message}`);
      }
    }
  } catch (e: any) {
    if (e.message === 'RATE_LIMITED') throw e;
    result.errors.push(e.message);
  }

  return result;
}

async function syncLeads(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  domain: string,
  apiToken: string,
  since: string
): Promise<SyncResult> {
  const result: SyncResult = { resource: 'leads', fetched: 0, upserted: 0, errors: [] };

  try {
    // Pipedrive leads endpoint (LeadBooster / Leads Inbox)
    const params = new URLSearchParams({ api_token: apiToken, limit: '100' });
    const url = `https://${domain}.pipedrive.com/api/v1/leads?${params}`;
    const res = await fetch(url);

    if (res.status === 429) throw new Error('RATE_LIMITED');
    if (!res.ok) {
      // Leads API may not be available on all Pipedrive plans
      if (res.status === 403 || res.status === 404) {
        result.errors.push('Leads API not available on this Pipedrive plan');
        return result;
      }
      throw new Error(`Pipedrive leads API ${res.status}`);
    }

    const json = await res.json();
    const leads = json.data ?? [];
    result.fetched = leads.length;

    for (const l of leads) {
      try {
        // Get person details if linked
        let contactName = null;
        let contactEmail = null;
        let contactId = null;

        if (l.person_id) {
          const { data: contact } = await supabase
            .from('contacts')
            .select('id, name, email')
            .eq('user_id', userId)
            .eq('pipedrive_id', l.person_id)
            .maybeSingle();
          if (contact) {
            contactId = contact.id;
            contactName = contact.name;
            contactEmail = contact.email;
          }
        }

        const mapped: any = {
          user_id: userId,
          pipedrive_id: l.id,
          company: l.organization_name ?? l.title ?? `Lead #${l.id}`,
          contact_id: contactId,
          source: l.source_name ?? 'pipedrive',
          status: l.is_archived ? 'dead' : 'new',
          notes: l.note ?? null,
          updated_at: new Date().toISOString(),
        };

        // Add label as tag
        if (l.label_ids?.length) {
          mapped.tags = l.label_ids.map((id: number) => `label_${id}`);
        }

        const { error } = await supabase
          .from('leads')
          .upsert(mapped, { onConflict: 'user_id,pipedrive_id' });

        if (error) {
          result.errors.push(`lead ${l.id}: ${error.message}`);
        } else {
          result.upserted++;
        }
      } catch (e: any) {
        result.errors.push(`lead ${l.id}: ${e.message}`);
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

      for (const resource of ['deals', 'persons', 'leads', 'activities', 'notes']) {
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
          } else if (resource === 'leads') {
            syncResult = await syncLeads(supabase, userId, domain, apiToken, since);
          } else if (resource === 'notes') {
            syncResult = await syncNotes(supabase, userId, domain, apiToken, since);
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
