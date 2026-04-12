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

  // ---- Money Intelligence ----

  const { data: snapshots7d } = await supabase
    .from('daily_snapshot')
    .select('date, pipeline_value, trading_pnl, ai_spend_usd')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .order('date');

  const sparkline = (snapshots7d ?? []).map((s: any) => (s.trading_pnl ?? 0) - (s.ai_spend_usd ?? 0));

  const todayNet = tradingPnl - (snapshot?.ai_spend_usd ?? 0);
  const lastWeekSnaps = (snapshots7d ?? []).slice(0, Math.max(1, (snapshots7d ?? []).length - 1));
  const lastWeekAvg = lastWeekSnaps.length > 0
    ? lastWeekSnaps.reduce((s: number, snap: any) => s + ((snap.trading_pnl ?? 0) - (snap.ai_spend_usd ?? 0)), 0) / lastWeekSnaps.length
    : 0;
  const vsLastWeekPct = lastWeekAvg !== 0 ? ((todayNet - lastWeekAvg) / Math.abs(lastWeekAvg)) * 100 : 0;

  const velocity = {
    daily_net: Math.round(todayNet),
    vs_last_week_pct: Math.round(vsLastWeekPct * 10) / 10,
    sales_contribution: Math.round(pipelineValue * 0.01),
    trading_contribution: Math.round(tradingPnl),
    cost_drag: -Math.round(snapshot?.ai_spend_usd ?? 0),
    sparkline_7d: sparkline,
  };

  const closingSoon = deals.filter((d: any) => {
    if (!d.close_date) return false;
    const daysToClose = Math.floor((new Date(d.close_date).getTime() - Date.now()) / 86400000);
    return daysToClose >= 0 && daysToClose <= 7;
  });

  const { data: allExpenses } = await supabase
    .from('expenses').select('*').eq('user_id', userId).eq('active', true);

  const monthlyBurn = (allExpenses ?? []).reduce((s: number, e: any) => {
    const amt = e.amount_usd ?? 0;
    switch (e.frequency) {
      case 'weekly': return s + amt * 4.33;
      case 'annual': return s + amt / 12;
      default: return s + amt;
    }
  }, 0);

  const openPnl = positions.reduce((s: number, p: any) => s + (p.pnl_usd ?? 0), 0);
  const todayTradingPnl = tradeJournal?.pnl_usd ?? 0;
  const winRateToday = tradeJournal ? (tradeJournal.wins + tradeJournal.losses > 0 ? tradeJournal.wins / (tradeJournal.wins + tradeJournal.losses) : 0) : 0;

  const moneyEngines = {
    sales: { pipeline_value: Math.round(pipelineValue), deals_closing_soon: closingSoon.length, weighted_value: Math.round(deals.reduce((s: number, d: any) => s + (d.value_usd ?? 0) * ((d.probability ?? 50) / 100), 0)), status: `${closingSoon.length} deal${closingSoon.length !== 1 ? 's' : ''} closing this week` },
    trading: { open_pnl: Math.round(openPnl), today_pnl: Math.round(todayTradingPnl), win_rate_today: Math.round(winRateToday * 100) / 100, open_positions: positions.length, status: `${todayTradingPnl >= 0 ? '+' : ''}$${Math.abs(Math.round(todayTradingPnl))} today, ${Math.round(winRateToday * 100)}% win rate` },
    ops: { monthly_burn: Math.round(monthlyBurn), active_subscriptions: (allExpenses ?? []).length, vs_last_month: 0, status: `${(allExpenses ?? []).length} active subs, $${Math.round(monthlyBurn)}/mo` },
  };

  const moneyLeaks: any[] = [];
  const noStopPositions = positions.filter((p: any) => !p.stop_loss);
  if (noStopPositions.length > 0) {
    const exposedValue = noStopPositions.reduce((s: number, p: any) => s + Math.abs((p.entry_price ?? 0) * (p.size ?? 0)), 0);
    moneyLeaks.push({ id: 'no-stoploss', type: 'unprotected_position', text: `${noStopPositions.length} position${noStopPositions.length > 1 ? 's' : ''} with no stop-loss, $${Math.round(exposedValue).toLocaleString()} exposed`, amount: Math.round(exposedValue), severity: 'high' });
  }
  const aiSpent = snapshot?.ai_spend_usd ?? 0;
  if (aiSpent > 16) {
    moneyLeaks.push({ id: 'ai-overspend', type: 'ai_overspend', text: `AI spend ${Math.round((aiSpent / 20) * 100)}% of daily budget`, amount: Math.round(aiSpent), severity: aiSpent > 20 ? 'high' : 'medium' });
  }
  if (staleDeals.length > 0) {
    const staleValue = staleDeals.reduce((s: number, d: any) => s + (d.value_usd ?? 0), 0);
    moneyLeaks.push({ id: 'stale-pipeline', type: 'stale_pipeline', text: `$${Math.round(staleValue).toLocaleString()} pipeline going stale (${staleDeals.length} deal${staleDeals.length > 1 ? 's' : ''})`, amount: Math.round(staleValue), severity: 'high' });
  }

  const deployRecs: any[] = [];
  for (const d of closingSoon.slice(0, 2)) {
    deployRecs.push({ id: `close-${d.id}`, type: 'close_deal', text: `Close ${d.company} = +$${(d.value_usd ?? 0).toLocaleString()} revenue`, impact: d.value_usd ?? 0, icon: 'DollarSign' });
  }
  if (noStopPositions.length > 0) {
    const exposedValue = noStopPositions.reduce((s: number, p: any) => s + Math.abs((p.entry_price ?? 0) * (p.size ?? 0)), 0);
    deployRecs.push({ id: 'set-stops', type: 'reduce_risk', text: `Set stop-losses = reduce $${Math.round(exposedValue).toLocaleString()} open risk`, impact: Math.round(exposedValue), icon: 'Shield' });
  }
  deployRecs.sort((a: any, b: any) => b.impact - a.impact);

  const { data: weekJournals } = await supabase
    .from('trade_journal').select('*').eq('user_id', userId)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)).order('date');
  const weekTotals = (weekJournals ?? []).reduce((acc: any, j: any) => ({ wins: acc.wins + (j.wins ?? 0), losses: acc.losses + (j.losses ?? 0), pnl: acc.pnl + (j.pnl_usd ?? 0) }), { wins: 0, losses: 0, pnl: 0 });

  const { data: closedThisWeek } = await supabase
    .from('positions').select('ticker, pnl_usd').eq('user_id', userId).eq('status', 'closed')
    .gte('closed_at', new Date(Date.now() - 7 * 86400000).toISOString()).order('pnl_usd', { ascending: false });
  const bestTrade = (closedThisWeek ?? [])[0] ?? null;
  const worstTrade = (closedThisWeek ?? []).length > 0 ? (closedThisWeek ?? [])[(closedThisWeek ?? []).length - 1] : null;

  const moneyScorecard = {
    today: { wins: tradeJournal?.wins ?? 0, losses: tradeJournal?.losses ?? 0, pnl: Math.round(todayTradingPnl) },
    week: { wins: weekTotals.wins, losses: weekTotals.losses, pnl: Math.round(weekTotals.pnl) },
    best_trade: bestTrade ? { ticker: bestTrade.ticker, pnl: Math.round(bestTrade.pnl_usd) } : null,
    worst_trade: worstTrade && worstTrade.pnl_usd < 0 ? { ticker: worstTrade.ticker, pnl: Math.round(worstTrade.pnl_usd) } : null,
    avg_hold_hours: 0,
  };

  const categoryMap: Record<string, { amount: number; count: number }> = {};
  for (const e of (allExpenses ?? [])) {
    const cat = e.category ?? 'other';
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    const monthly = e.frequency === 'weekly' ? (e.amount_usd ?? 0) * 4.33 : e.frequency === 'annual' ? (e.amount_usd ?? 0) / 12 : (e.amount_usd ?? 0);
    categoryMap[cat].amount += monthly;
    categoryMap[cat].count++;
  }
  const expenseRadar = Object.entries(categoryMap)
    .map(([category, { amount, count }]) => ({ category, amount: Math.round(amount), count }))
    .sort((a, b) => b.amount - a.amount);

  await supabase.from('money_intelligence').upsert({
    user_id: userId, date: today, velocity, engines: moneyEngines, leaks: moneyLeaks,
    deploy: deployRecs.slice(0, 4), scorecard: moneyScorecard, expense_radar: expenseRadar,
    computed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' });

  return { heroStats, topFive: topFive.length, nextActions: nextActions.length, wasteAlerts: wasteAlerts.length, suggestions: newSuggestions.length, money: { velocity: velocity.daily_net, leaks: moneyLeaks.length, deploys: deployRecs.length } };
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
