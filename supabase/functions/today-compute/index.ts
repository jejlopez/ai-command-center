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

function daysSince(ts: string | null): number {
  if (!ts) return 999;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function computeForUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const today = todayIso();

  const [dealsRes, fuRes, posRes, habitsRes, expRes, tjRes, snapRes] = await Promise.all([
    supabase.from('deals').select('*').eq('user_id', userId).not('stage', 'in', '("closed_won","closed_lost")'),
    supabase.from('follow_ups').select('*, deals(company), contacts(name)').eq('user_id', userId).in('status', ['pending', 'waiting']),
    supabase.from('positions').select('*').eq('user_id', userId).eq('status', 'open'),
    supabase.from('habits').select('*').eq('user_id', userId).eq('active', true),
    supabase.from('expenses').select('*').eq('user_id', userId).eq('active', true),
    supabase.from('trade_journal').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
    supabase.from('daily_snapshot').select('*').eq('user_id', userId).eq('date', today).maybeSingle(),
  ]);

  const deals = dealsRes.data ?? [];
  const followUps = fuRes.data ?? [];
  const positions = posRes.data ?? [];
  const habits = habitsRes.data ?? [];
  const expenses = expRes.data ?? [];
  const tradeJournal = tjRes.data;
  const snapshot = snapRes.data;

  // Hero Stats
  const pipelineValue = deals.reduce((s: number, d: any) => s + (d.value_usd ?? 0), 0);
  const tradingPnl = positions.reduce((s: number, p: any) => s + (p.pnl_usd ?? 0), 0) + (tradeJournal?.pnl_usd ?? 0);
  const followUpsDue = followUps.filter((f: any) => f.status === 'pending' && f.due_date <= today).length;

  const heroStats = {
    meetings: snapshot?.meetings_count ?? 0,
    pipeline_value: pipelineValue,
    trading_pnl: tradingPnl,
    follow_ups_due: followUpsDue,
    budget_remaining: Math.max(0, 20 - (snapshot?.ai_spend_usd ?? 0)),
  };

  // Top Five Focus
  const scored: any[] = [];
  for (const d of deals) {
    scored.push({ type: 'deal', id: d.id, label: `${d.company} — ${d.stage}`, value: `$${(d.value_usd ?? 0).toLocaleString()}`, role: 'Sales', score: (d.value_usd ?? 0) * ((d.probability ?? 50) / 100) });
  }
  for (const p of positions) {
    scored.push({ type: 'position', id: p.id, label: `${p.ticker} ${p.side}`, value: `${(p.pnl_usd ?? 0) >= 0 ? '+' : ''}$${Math.abs(p.pnl_usd ?? 0).toLocaleString()}`, role: 'Trading', score: Math.abs(p.pnl_usd ?? 0) });
  }
  for (const f of followUps.filter((f: any) => f.priority === 'urgent' || f.priority === 'high')) {
    scored.push({ type: 'followup', id: f.id, label: f.action, value: f.priority, role: 'Action', score: f.priority === 'urgent' ? 100000 : 50000 });
  }
  scored.sort((a: any, b: any) => b.score - a.score);
  const topFive = scored.slice(0, 5);

  // Next Actions
  const nextActions: any[] = [];
  for (const d of deals) {
    const age = daysSince(d.last_touch);
    if (age >= 3) nextActions.push({ type: 'stale_deal', text: `Follow up with ${d.company} (${age}d stale)`, icon: 'Phone', age, target_id: d.id });
  }
  for (const p of positions) {
    if (!p.stop_loss) nextActions.push({ type: 'no_stoploss', text: `Set stop-loss for ${p.ticker}`, icon: 'TrendingUp', age: null, target_id: p.id });
  }
  for (const h of habits) {
    if (h.last_done !== today) nextActions.push({ type: 'habit', text: `Log: ${h.name}`, icon: 'Heart', age: null, target_id: h.id });
  }

  // Waiting On
  const waitingOn = followUps
    .filter((f: any) => f.status === 'waiting')
    .map((f: any) => ({ id: f.id, action: f.action, contact: f.contacts?.name ?? null, company: f.deals?.company ?? null, days: daysSince(f.created_at) }));

  // Waste Alerts
  const wasteAlerts: any[] = [];
  const staleDeals = deals.filter((d: any) => daysSince(d.last_touch) > 7);
  if (staleDeals.length > 0) wasteAlerts.push({ id: 'stale-deals', type: 'stale_deals', text: `${staleDeals.length} deal${staleDeals.length > 1 ? 's' : ''} going stale (7+ days)`, severity: 'high' });

  const dueExpenses = expenses.filter((e: any) => e.next_due && e.next_due <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  for (const exp of dueExpenses) wasteAlerts.push({ id: `exp-${exp.id}`, type: 'expense_due', text: `$${exp.amount_usd} due: ${exp.name}`, severity: 'medium' });

  const noStop = positions.filter((p: any) => !p.stop_loss);
  if (noStop.length > 0) wasteAlerts.push({ id: 'no-stoploss', type: 'no_stoploss', text: `${noStop.length} position${noStop.length > 1 ? 's' : ''} with no stop-loss`, severity: 'high' });

  for (const h of habits) {
    if (h.current_streak > 0 && h.last_done && h.last_done < today && daysSince(h.last_done + 'T00:00:00') >= 2) {
      wasteAlerts.push({ id: `habit-${h.id}`, type: 'broken_streak', text: `${h.name} streak broken after ${h.current_streak}d`, severity: 'medium' });
    }
  }

  // Suggestions
  const newSuggestions: any[] = [];
  for (const d of staleDeals) newSuggestions.push({ type: 'follow_up', suggestion: `Follow up with ${d.company} — deal untouched for ${daysSince(d.last_touch)} days`, context: { deal_id: d.id, company: d.company } });
  for (const p of noStop) newSuggestions.push({ type: 'trade_alert', suggestion: `Set a stop-loss on ${p.ticker} (${p.side}, entry $${p.entry_price})`, context: { position_id: p.id, ticker: p.ticker } });

  if (newSuggestions.length > 0) {
    await supabase.from('jarvis_suggestions').insert(newSuggestions.map((s: any) => ({ user_id: userId, ...s })));
  }

  // Upsert intelligence
  await supabase.from('today_intelligence').upsert({
    user_id: userId, date: today, hero_stats: heroStats, top_five: topFive,
    next_actions: nextActions.slice(0, 4), waiting_on: waitingOn, waste_alerts: wasteAlerts,
    suggestions: newSuggestions.map((s: any) => s.suggestion), computed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' });

  return { heroStats, topFive: topFive.length, nextActions: nextActions.length, wasteAlerts: wasteAlerts.length, suggestions: newSuggestions.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS_HEADERS });

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') ?? 'manual';
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) return corsResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (mode === 'cron') {
      const { data: users } = await supabase.from('deals').select('user_id').limit(100);
      const uniqueUsers = [...new Set((users ?? []).map((u: any) => u.user_id))];
      const results: Record<string, any> = {};
      for (const userId of uniqueUsers) results[userId] = await computeForUser(supabase, userId);
      return corsResponse({ mode: 'cron', users_processed: uniqueUsers.length, results });
    }

    let body: any = {};
    try { body = await req.json(); } catch {}
    const userId = body.user_id;
    if (!userId) return corsResponse({ error: 'user_id required for trigger/manual mode' }, 400);

    const result = await computeForUser(supabase, userId);
    return corsResponse({ mode, user_id: userId, ...result });
  } catch (err: any) {
    return corsResponse({ error: err.message ?? String(err) }, 500);
  }
});
