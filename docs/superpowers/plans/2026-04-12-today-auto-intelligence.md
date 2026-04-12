# Today Auto-Intelligence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Today Cockpit fully auto-updating with precomputed server-side intelligence, Supabase Realtime push, cron refresh, database triggers, and webhook skeletons.

**Architecture:** Edge Function `today-compute` reads source tables, computes all derived metrics, and upserts a single `today_intelligence` row per user per day. Database triggers on `deals`/`follow_ups`/`positions` invoke the function on change. `pg_cron` runs it every 15min during work hours. Frontend subscribes to one Realtime channel and reads one precomputed row.

**Tech Stack:** Supabase Edge Functions (Deno), pg_cron, pg_net, Supabase Realtime, React hooks

**Spec:** `docs/superpowers/specs/2026-04-12-today-auto-intelligence-design.md`

---

### Task 1: Migration — `today_intelligence` table + triggers + cron

**Files:**
- Create: `supabase/migrations/20260412_today_intelligence.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Today Auto-Intelligence Layer
-- Precomputed dashboard state + DB triggers + cron schedules

-- 1. Intelligence table (one row per user per day)
create table if not exists today_intelligence (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  hero_stats  jsonb not null default '{}',
  top_five    jsonb not null default '[]',
  next_actions jsonb not null default '[]',
  waiting_on  jsonb not null default '[]',
  waste_alerts jsonb not null default '[]',
  suggestions jsonb not null default '[]',
  computed_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table today_intelligence enable row level security;
create policy "today_intelligence_owner" on today_intelligence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_today_intelligence_user_date
  on today_intelligence(user_id, date);

-- 2. Enable Realtime on today_intelligence
-- NOTE: If this errors, enable manually in Dashboard → Database → Replication
alter publication supabase_realtime add table today_intelligence;

-- 3. Enable pg_net extension (for triggers calling Edge Functions)
create extension if not exists pg_net with schema extensions;

-- 4. Trigger function: calls today-compute Edge Function on source table changes
create or replace function notify_today_compute() returns trigger as $$
declare
  _url text;
  _key text;
begin
  begin
    _url := current_setting('app.settings.supabase_url', true);
    _key := current_setting('app.settings.service_role_key', true);
  exception when others then
    -- Settings not configured yet — skip silently
    return coalesce(new, old);
  end;

  if _url is null or _key is null then
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := _url || '/functions/v1/today-compute?mode=trigger',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || _key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('user_id', coalesce(new.user_id, old.user_id))
  );

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- 5. Attach triggers to source tables
create trigger deals_today_compute
  after insert or update or delete on deals
  for each row execute function notify_today_compute();

create trigger follow_ups_today_compute
  after insert or update or delete on follow_ups
  for each row execute function notify_today_compute();

create trigger positions_today_compute
  after insert or update or delete on positions
  for each row execute function notify_today_compute();

-- 6. Cron schedules (requires pg_cron extension — enable in Dashboard first)
-- These will error if pg_cron is not enabled; that's OK, set up manually in that case.
do $$
begin
  -- Every 15min during work hours (6am-8pm)
  perform cron.schedule(
    'today-compute-frequent',
    '*/15 6-20 * * *',
    $cron$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/today-compute?mode=cron',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
    $cron$
  );

  -- Overnight at 9pm, midnight, 3am
  perform cron.schedule(
    'today-compute-overnight',
    '0 21,0,3 * * *',
    $cron$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/today-compute?mode=cron',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
    $cron$
  );
exception when others then
  raise notice 'pg_cron not available — set up cron schedules manually in Supabase Dashboard';
end;
$$;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/20260412_today_intelligence.sql
git commit -m "feat: add today_intelligence table, DB triggers, and cron schedules"
```

---

### Task 2: Edge Function — `today-compute`

**Files:**
- Create: `supabase/functions/today-compute/index.ts`

- [ ] **Step 1: Create the Edge Function**

```typescript
// supabase/functions/today-compute/index.ts
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

interface HeroStats {
  meetings: number;
  pipeline_value: number;
  trading_pnl: number;
  follow_ups_due: number;
  budget_remaining: number;
}

interface TopFiveItem {
  type: string;
  id: string;
  label: string;
  value: string;
  role: string;
  score: number;
}

interface NextAction {
  type: string;
  text: string;
  icon: string;
  age: number | null;
  target_id: string | null;
}

interface WaitingItem {
  id: string;
  action: string;
  contact: string | null;
  company: string | null;
  days: number;
}

interface WasteAlert {
  id: string;
  type: string;
  text: string;
  severity: string;
}

async function computeForUser(supabase: ReturnType<typeof createClient>, userId: string) {
  const today = todayIso();

  // Parallel fetch all source tables
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

  // --- Hero Stats ---
  const pipelineValue = deals.reduce((s: number, d: any) => s + (d.value_usd ?? 0), 0);
  const tradingPnl = positions.reduce((s: number, p: any) => s + (p.pnl_usd ?? 0), 0) + (tradeJournal?.pnl_usd ?? 0);
  const followUpsDue = followUps.filter((f: any) => f.status === 'pending' && f.due_date <= today).length;

  const heroStats: HeroStats = {
    meetings: snapshot?.meetings_count ?? 0,
    pipeline_value: pipelineValue,
    trading_pnl: tradingPnl,
    follow_ups_due: followUpsDue,
    budget_remaining: Math.max(0, 20 - (snapshot?.ai_spend_usd ?? 0)),
  };

  // --- Top Five Focus ---
  const scored: TopFiveItem[] = [];

  for (const d of deals) {
    const score = (d.value_usd ?? 0) * ((d.probability ?? 50) / 100);
    scored.push({
      type: 'deal', id: d.id,
      label: `${d.company} — ${d.stage}`,
      value: `$${(d.value_usd ?? 0).toLocaleString()}`,
      role: 'Sales', score,
    });
  }

  for (const p of positions) {
    const score = Math.abs(p.pnl_usd ?? 0);
    scored.push({
      type: 'position', id: p.id,
      label: `${p.ticker} ${p.side}`,
      value: `${(p.pnl_usd ?? 0) >= 0 ? '+' : ''}$${Math.abs(p.pnl_usd ?? 0).toLocaleString()}`,
      role: 'Trading', score,
    });
  }

  for (const f of followUps.filter((f: any) => f.priority === 'urgent' || f.priority === 'high')) {
    scored.push({
      type: 'followup', id: f.id,
      label: f.action,
      value: f.priority,
      role: 'Action',
      score: f.priority === 'urgent' ? 100000 : 50000,
    });
  }

  scored.sort((a, b) => b.score - a.score);
  const topFive = scored.slice(0, 5);

  // --- Next Actions ---
  const nextActions: NextAction[] = [];

  for (const d of deals) {
    const age = daysSince(d.last_touch);
    if (age >= 3) {
      nextActions.push({ type: 'stale_deal', text: `Follow up with ${d.company} (${age}d stale)`, icon: 'Phone', age, target_id: d.id });
    }
  }

  for (const p of positions) {
    if (!p.stop_loss) {
      nextActions.push({ type: 'no_stoploss', text: `Set stop-loss for ${p.ticker}`, icon: 'TrendingUp', age: null, target_id: p.id });
    }
  }

  for (const h of habits) {
    if (h.last_done !== today) {
      nextActions.push({ type: 'habit', text: `Log: ${h.name}`, icon: 'Heart', age: null, target_id: h.id });
    }
  }

  // --- Waiting On ---
  const waitingOn: WaitingItem[] = followUps
    .filter((f: any) => f.status === 'waiting')
    .map((f: any) => ({
      id: f.id,
      action: f.action,
      contact: f.contacts?.name ?? null,
      company: f.deals?.company ?? null,
      days: daysSince(f.created_at),
    }));

  // --- Waste Alerts ---
  const wasteAlerts: WasteAlert[] = [];

  const staleDeals = deals.filter((d: any) => daysSince(d.last_touch) > 7);
  if (staleDeals.length > 0) {
    wasteAlerts.push({ id: 'stale-deals', type: 'stale_deals', text: `${staleDeals.length} deal${staleDeals.length > 1 ? 's' : ''} going stale (7+ days)`, severity: 'high' });
  }

  const dueExpenses = expenses.filter((e: any) => e.next_due && e.next_due <= new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10));
  for (const exp of dueExpenses) {
    wasteAlerts.push({ id: `exp-${exp.id}`, type: 'expense_due', text: `$${exp.amount_usd} due: ${exp.name}`, severity: 'medium' });
  }

  const noStop = positions.filter((p: any) => !p.stop_loss);
  if (noStop.length > 0) {
    wasteAlerts.push({ id: 'no-stoploss', type: 'no_stoploss', text: `${noStop.length} position${noStop.length > 1 ? 's' : ''} with no stop-loss`, severity: 'high' });
  }

  for (const h of habits) {
    if (h.current_streak > 0 && h.last_done && h.last_done < today) {
      const missed = daysSince(h.last_done + 'T00:00:00');
      if (missed >= 2) {
        wasteAlerts.push({ id: `habit-${h.id}`, type: 'broken_streak', text: `${h.name} streak broken after ${h.current_streak}d`, severity: 'medium' });
      }
    }
  }

  // --- Suggestions (write to jarvis_suggestions) ---
  const newSuggestions: Array<{ type: string; suggestion: string; context: any }> = [];

  for (const d of staleDeals) {
    newSuggestions.push({
      type: 'follow_up',
      suggestion: `Follow up with ${d.company} — deal has been untouched for ${daysSince(d.last_touch)} days`,
      context: { deal_id: d.id, company: d.company, days_stale: daysSince(d.last_touch) },
    });
  }

  for (const p of noStop) {
    newSuggestions.push({
      type: 'trade_alert',
      suggestion: `Set a stop-loss on ${p.ticker} (${p.side} position, entry $${p.entry_price})`,
      context: { position_id: p.id, ticker: p.ticker },
    });
  }

  // Insert suggestions (only if there are new ones)
  if (newSuggestions.length > 0) {
    await supabase.from('jarvis_suggestions').insert(
      newSuggestions.map((s) => ({ user_id: userId, ...s }))
    );
  }

  // --- Upsert today_intelligence ---
  await supabase.from('today_intelligence').upsert({
    user_id: userId,
    date: today,
    hero_stats: heroStats,
    top_five: topFive,
    next_actions: nextActions.slice(0, 4),
    waiting_on: waitingOn,
    waste_alerts: wasteAlerts,
    suggestions: newSuggestions.map((s) => s.suggestion),
    computed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' });

  return { heroStats, topFive: topFive.length, nextActions: nextActions.length, wasteAlerts: wasteAlerts.length, suggestions: newSuggestions.length };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get('mode') ?? 'manual';

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return corsResponse({ error: 'Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    if (mode === 'cron') {
      // Process all users that have data
      const { data: users } = await supabase.from('deals').select('user_id').limit(100);
      const uniqueUsers = [...new Set((users ?? []).map((u: any) => u.user_id))];

      const results: Record<string, any> = {};
      for (const userId of uniqueUsers) {
        results[userId] = await computeForUser(supabase, userId);
      }

      return corsResponse({ mode: 'cron', users_processed: uniqueUsers.length, results });
    }

    // trigger or manual — need user_id
    let body: any = {};
    try { body = await req.json(); } catch { /* empty body OK for GET */ }
    const userId = body.user_id;

    if (!userId) {
      return corsResponse({ error: 'user_id required for trigger/manual mode' }, 400);
    }

    const result = await computeForUser(supabase, userId);
    return corsResponse({ mode, user_id: userId, ...result });

  } catch (err: any) {
    return corsResponse({ error: err.message ?? String(err) }, 500);
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/today-compute/index.ts
git commit -m "feat: add today-compute Edge Function — precomputes dashboard intelligence"
```

---

### Task 3: Edge Function — `external-sync` (skeleton)

**Files:**
- Create: `supabase/functions/external-sync/index.ts`

- [ ] **Step 1: Create the webhook skeleton**

```typescript
// supabase/functions/external-sync/index.ts
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
function mapPipedriveDeal(payload: any): any {
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
  return null; // Not wired yet
}

// Pipedrive person → contacts table mapping (skeleton)
function mapPipedrivePerson(payload: any): any {
  // return {
  //   name: payload.current?.name,
  //   company: payload.current?.org_name,
  //   email: payload.current?.email?.[0]?.value,
  //   phone: payload.current?.phone?.[0]?.value,
  //   last_interaction: new Date().toISOString(),
  // };
  return null; // Not wired yet
}

// Trading API → positions table mapping (skeleton)
function mapTradePosition(payload: any): any {
  // return {
  //   ticker: payload.symbol,
  //   side: payload.side,
  //   entry_price: payload.avg_entry_price,
  //   size: payload.qty,
  //   current_price: payload.current_price,
  //   pnl_usd: payload.unrealized_pl,
  //   status: payload.qty > 0 ? 'open' : 'closed',
  // };
  return null; // Not wired yet
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const source = url.searchParams.get('source') ?? 'unknown';

  let body: any = {};
  try { body = await req.json(); } catch { /* empty body */ }

  console.log(`[external-sync] Received webhook from ${source}:`, JSON.stringify(body).slice(0, 500));

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    return corsResponse({ error: 'Missing env vars' }, 500);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  switch (source) {
    case 'pipedrive': {
      const event = body.event ?? body.meta?.action;
      console.log(`[external-sync] Pipedrive event: ${event}`);

      if (event === 'updated.deal' || event === 'added.deal') {
        const mapped = mapPipedriveDeal(body);
        if (mapped) {
          // await supabase.from('deals').upsert(mapped, { onConflict: ... });
          console.log('[external-sync] Pipedrive deal mapping ready but not wired');
        }
      }

      if (event === 'updated.person' || event === 'added.person') {
        const mapped = mapPipedrivePerson(body);
        if (mapped) {
          // await supabase.from('contacts').upsert(mapped, { onConflict: ... });
          console.log('[external-sync] Pipedrive person mapping ready but not wired');
        }
      }

      return corsResponse({ received: true, source: 'pipedrive', event, synced: false, reason: 'mapping not wired yet' });
    }

    case 'trading': {
      const mapped = mapTradePosition(body);
      if (mapped) {
        // await supabase.from('positions').upsert(mapped);
        console.log('[external-sync] Trading position mapping ready but not wired');
      }
      return corsResponse({ received: true, source: 'trading', synced: false, reason: 'mapping not wired yet' });
    }

    default:
      return corsResponse({ received: true, source, synced: false, reason: `unknown source: ${source}` });
  }
});
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/external-sync/index.ts
git commit -m "feat: add external-sync Edge Function skeleton — Pipedrive + trading webhook receiver"
```

---

### Task 4: Modify `useTodaySupa` — single query + Realtime

**Files:**
- Modify: `src/hooks/useTodaySupa.js`

- [ ] **Step 1: Rewrite the hook to read precomputed intelligence + subscribe to Realtime**

```js
// src/hooks/useTodaySupa.js
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodaySupa() {
  const [data, setData] = useState({
    intelligence: null,
    loading: true,
    error: null,
  });
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ intelligence: null, loading: false, error: "Supabase not configured" });
      return;
    }
    try {
      const { data: row, error } = await supabase
        .from("today_intelligence")
        .select("*")
        .eq("date", todayIso())
        .maybeSingle();

      if (error) throw error;

      setData({ intelligence: row, loading: false, error: null });
    } catch (e) {
      setData({ intelligence: null, loading: false, error: e.message });
    }
  }, []);

  useEffect(() => {
    refresh();

    // Subscribe to Realtime changes on today_intelligence
    if (supabase) {
      const channel = supabase
        .channel("today-intel")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "today_intelligence" },
          () => refresh()
        )
        .subscribe();

      channelRef.current = channel;
    }

    return () => {
      if (channelRef.current) {
        supabase?.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [refresh]);

  // Manual recompute trigger — calls the Edge Function then refreshes
  const recompute = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/today-compute?mode=manual`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${anonKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ user_id: user.id }),
      });

      // Realtime will trigger refresh, but also refresh explicitly for speed
      await refresh();
    } catch (e) {
      console.error("[useTodaySupa] recompute failed:", e);
    }
  }, [refresh]);

  return { ...data, refresh, recompute };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useTodaySupa.js
git commit -m "feat: rewrite useTodaySupa — single precomputed row + Realtime subscription"
```

---

### Task 5: Modify `Today.jsx` — read precomputed JSONB

**Files:**
- Modify: `src/views/Today.jsx`

- [ ] **Step 1: Rewrite Today.jsx to consume precomputed intelligence**

```jsx
// src/views/Today.jsx
import { useToday, useJarvisBrief, useCostToday } from "../hooks/useJarvis.js";
import { useTodaySupa } from "../hooks/useTodaySupa.js";
import { MorningBriefHero } from "../components/today/MorningBriefHero.jsx";
import { TopFiveFocus } from "../components/today/TopFiveFocus.jsx";
import { NextBestActions } from "../components/today/NextBestActions.jsx";
import { TimeBlocks } from "../components/today/TimeBlocks.jsx";
import { WaitingOn } from "../components/today/WaitingOn.jsx";
import { WasteDetector } from "../components/today/WasteDetector.jsx";
import { EndOfDayReview } from "../components/today/EndOfDayReview.jsx";
import { NotificationToast } from "../components/today/NotificationToast.jsx";

export default function Today() {
  const { items, refresh: calRefresh } = useToday();
  const { brief, regenerateBrief, loading: briefLoading } = useJarvisBrief();
  const { cost } = useCostToday();
  const { intelligence, recompute } = useTodaySupa();

  const hero = intelligence?.hero_stats ?? {};
  const budgetRemaining = cost ? (cost.budgetUsd ?? 20) - (cost.spentUsd ?? 0) : hero.budget_remaining;

  const meetingCount = (items ?? []).filter((i) => i.kind !== "focus").length;

  const showEod = new Date().getHours() >= 17;

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <MorningBriefHero
          brief={brief}
          meetingCount={meetingCount || hero.meetings}
          pipelineValue={hero.pipeline_value}
          tradingPnl={hero.trading_pnl}
          followUpsDue={hero.follow_ups_due}
          budgetRemaining={budgetRemaining}
          onRegenerate={regenerateBrief}
          regenerating={briefLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopFiveFocus precomputed={intelligence?.top_five} />
          <NextBestActions precomputed={intelligence?.next_actions} onRecompute={recompute} />
        </div>

        <TimeBlocks items={items} onRefresh={calRefresh} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WaitingOn precomputed={intelligence?.waiting_on} onRecompute={recompute} />
          <WasteDetector precomputed={intelligence?.waste_alerts} />
        </div>

        {showEod && <EndOfDayReview onSaved={recompute} />}
      </div>

      <NotificationToast />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/views/Today.jsx
git commit -m "feat: Today reads precomputed intelligence — zero client-side computation"
```

---

### Task 6: Update components to accept precomputed data

**Files:**
- Modify: `src/components/today/TopFiveFocus.jsx`
- Modify: `src/components/today/NextBestActions.jsx`
- Modify: `src/components/today/WaitingOn.jsx`
- Modify: `src/components/today/WasteDetector.jsx`
- Modify: `src/components/today/EndOfDayReview.jsx`

- [ ] **Step 1: Update TopFiveFocus to accept `precomputed` prop**

Add a `precomputed` prop path. If `precomputed` is provided (array from `today_intelligence.top_five`), render it directly. If not, fall back to the existing deals/positions/followUps computation (backward compatibility during migration).

At the top of the component, add:

```jsx
export function TopFiveFocus({ precomputed, deals, positions, followUps }) {
  const [expanded, setExpanded] = useState(null);

  // Use precomputed data if available, otherwise compute from raw tables
  const items = precomputed ?? computeItems(deals, positions, followUps);
```

Extract the existing scoring logic into a `computeItems` function:

```jsx
function computeItems(deals = [], positions = [], followUps = []) {
  // ... existing scoring code ...
  return scored.sort((a, b) => b.score - a.score).slice(0, 5);
}
```

Map precomputed items to match the render format: each precomputed item has `{ type, id, label, value, role, score }` — same shape, so rendering works directly.

- [ ] **Step 2: Update NextBestActions similarly**

Add `precomputed` prop. If provided, render the array directly. Each item has `{ type, text, icon, age, target_id }`. Map `icon` string to Lucide component:

```jsx
const ICON_MAP = { Phone, TrendingUp, Clock, Heart };

// In render:
const Icon = ICON_MAP[a.icon] ?? Clock;
```

- [ ] **Step 3: Update WaitingOn similarly**

Add `precomputed` prop. Each item has `{ id, action, contact, company, days }`. Render directly, using `days` for age coloring.

- [ ] **Step 4: Update WasteDetector similarly**

Add `precomputed` prop. Each item has `{ id, type, text, severity }`. Map severity to icon and color:

```jsx
const ICON_MAP = { stale_deals: TrendingDown, expense_due: CreditCard, no_stoploss: TrendingDown, broken_streak: Flame };
const COLOR_MAP = { high: "text-jarvis-red", medium: "text-jarvis-amber", low: "text-jarvis-body" };
```

- [ ] **Step 5: Update EndOfDayReview**

Remove `tradeJournal` prop (no longer passed from raw table query). The component already handles empty state. Add `onRecompute` call alongside `onSaved`.

- [ ] **Step 6: Commit**

```bash
git add src/components/today/TopFiveFocus.jsx src/components/today/NextBestActions.jsx src/components/today/WaitingOn.jsx src/components/today/WasteDetector.jsx src/components/today/EndOfDayReview.jsx
git commit -m "feat: update Today components to accept precomputed intelligence data"
```

---

### Task 7: NotificationToast component

**Files:**
- Create: `src/components/today/NotificationToast.jsx`

- [ ] **Step 1: Create the toast component**

```jsx
// src/components/today/NotificationToast.jsx
import { useEffect, useState, useRef } from "react";
import { Zap, X } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

export function NotificationToast() {
  const [toasts, setToasts] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel("jarvis-suggestions")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "jarvis_suggestions" },
        (payload) => {
          const suggestion = payload.new;
          if (!suggestion?.suggestion) return;

          const id = suggestion.id ?? Date.now();
          setToasts((prev) => [...prev, { id, text: suggestion.suggestion, type: suggestion.type }]);

          // Auto-dismiss after 8 seconds
          setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
          }, 8000);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  const dismiss = (id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 space-y-2 max-w-sm">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="glass border border-jarvis-cyan/30 shadow-glow-cyan p-4 rounded-2xl flex items-start gap-3 animate-slideUp"
        >
          <Zap size={16} className="text-jarvis-cyan shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="text-[10px] text-jarvis-cyan font-semibold uppercase tracking-wide">JARVIS</div>
            <div className="text-sm text-jarvis-ink mt-0.5">{t.text}</div>
          </div>
          <button
            onClick={() => dismiss(t.id)}
            className="shrink-0 p-1 rounded-lg text-jarvis-muted hover:text-jarvis-ink transition"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/today/NotificationToast.jsx
git commit -m "feat: add NotificationToast — proactive JARVIS alerts via Supabase Realtime"
```

---

### Task 8: Enable Realtime on `jarvis_suggestions`

**Files:**
- Modify: `supabase/migrations/20260412_today_intelligence.sql`

- [ ] **Step 1: Add Realtime publication for jarvis_suggestions**

Append to the migration file:

```sql
-- Also enable Realtime on jarvis_suggestions for proactive alert toasts
alter publication supabase_realtime add table jarvis_suggestions;
```

Or if the migration has already been run, create a new migration:

Create: `supabase/migrations/20260412_realtime_suggestions.sql`

```sql
alter publication supabase_realtime add table jarvis_suggestions;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/
git commit -m "feat: enable Realtime on jarvis_suggestions for proactive alert toasts"
```

---

### Task 9: Verify build + final commit

**Files:** None new

- [ ] **Step 1: Verify Vite build succeeds**

Run: `npx vite build`
Expected: Build succeeds with 0 errors.

- [ ] **Step 2: Verify git status is clean**

Run: `git status`
Expected: No unstaged changes.

- [ ] **Step 3: Final summary commit if needed**

If any files were missed:

```bash
git add -A
git commit -m "feat: complete Today Auto-Intelligence Layer — precomputed dashboard, Realtime, cron, webhooks"
```
