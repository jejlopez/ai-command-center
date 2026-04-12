# Money Command Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a financial war room with capital velocity tracking, three money engines, leak detection, deployment recommendations, trading scorecard, and expense radar — all precomputed server-side via the auto-intelligence layer.

**Architecture:** New `money_intelligence` table stores precomputed JSONB. The existing `today-compute` Edge Function is extended to also compute money metrics. Frontend reads one precomputed row via Realtime subscription. Zero client-side computation.

**Tech Stack:** React, Tailwind (jarvis theme), Supabase (Realtime + Edge Functions), Lucide icons, SVG sparklines

**Spec:** `docs/superpowers/specs/2026-04-12-m2b2-money-command-design.md`

---

### Task 1: Migration — `money_intelligence` table + expense trigger

**Files:**
- Create: `supabase/migrations/20260412_money_intelligence.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- Money Command Center — precomputed intelligence table

create table if not exists money_intelligence (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date          date not null default current_date,
  velocity      jsonb not null default '{}',
  engines       jsonb not null default '{}',
  leaks         jsonb not null default '[]',
  deploy        jsonb not null default '[]',
  scorecard     jsonb not null default '{}',
  expense_radar jsonb not null default '[]',
  computed_at   timestamptz not null default now(),
  unique(user_id, date)
);

alter table money_intelligence enable row level security;
create policy "money_intelligence_owner" on money_intelligence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_money_intelligence_user_date
  on money_intelligence(user_id, date);

alter publication supabase_realtime add table money_intelligence;

-- Trigger on expenses to recompute intelligence on change
create trigger expenses_today_compute
  after insert or update or delete on expenses
  for each row execute function notify_today_compute();
```

- [ ] **Step 2: Apply migration to remote**

Run: `supabase db query --linked -f supabase/migrations/20260412_money_intelligence.sql`

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260412_money_intelligence.sql
git commit -m "feat: add money_intelligence table + expense trigger"
```

---

### Task 2: Extend `today-compute` Edge Function with money computation

**Files:**
- Modify: `supabase/functions/today-compute/index.ts`

- [ ] **Step 1: Read the existing Edge Function, then add money computation**

After the existing `today_intelligence` upsert in the `computeForUser` function, add the money intelligence computation. Insert the following code block BEFORE the `return` statement at the end of `computeForUser`:

```typescript
  // ---- Money Intelligence ----

  // Velocity: 7-day daily snapshots
  const { data: snapshots7d } = await supabase
    .from('daily_snapshot')
    .select('date, pipeline_value, trading_pnl, ai_spend_usd')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .order('date');

  const sparkline = (snapshots7d ?? []).map((s: any) => {
    return (s.trading_pnl ?? 0) - (s.ai_spend_usd ?? 0);
  });

  const todayNet = tradingPnl - (snapshot?.ai_spend_usd ?? 0);
  const lastWeekSnaps = (snapshots7d ?? []).slice(0, Math.max(1, (snapshots7d ?? []).length - 1));
  const lastWeekAvg = lastWeekSnaps.length > 0
    ? lastWeekSnaps.reduce((s: number, snap: any) => s + ((snap.trading_pnl ?? 0) - (snap.ai_spend_usd ?? 0)), 0) / lastWeekSnaps.length
    : 0;
  const vsLastWeekPct = lastWeekAvg !== 0 ? ((todayNet - lastWeekAvg) / Math.abs(lastWeekAvg)) * 100 : 0;

  const velocity = {
    daily_net: Math.round(todayNet),
    vs_last_week_pct: Math.round(vsLastWeekPct * 10) / 10,
    sales_contribution: Math.round(pipelineValue * 0.01), // rough: 1% of pipeline as daily revenue proxy
    trading_contribution: Math.round(tradingPnl),
    cost_drag: -Math.round(snapshot?.ai_spend_usd ?? 0),
    sparkline_7d: sparkline,
  };

  // Engines
  const closingSoon = deals.filter((d: any) => {
    if (!d.close_date) return false;
    const daysToClose = Math.floor((new Date(d.close_date).getTime() - Date.now()) / 86400000);
    return daysToClose >= 0 && daysToClose <= 7;
  });

  const { data: allExpenses } = await supabase
    .from('expenses')
    .select('*')
    .eq('user_id', userId)
    .eq('active', true);

  const monthlyBurn = (allExpenses ?? []).reduce((s: number, e: any) => {
    const amt = e.amount_usd ?? 0;
    switch (e.frequency) {
      case 'weekly': return s + amt * 4.33;
      case 'monthly': return s + amt;
      case 'annual': return s + amt / 12;
      default: return s + amt;
    }
  }, 0);

  const openPnl = positions.reduce((s: number, p: any) => s + (p.pnl_usd ?? 0), 0);
  const todayTradingPnl = tradeJournal?.pnl_usd ?? 0;
  const winRateToday = tradeJournal ? (tradeJournal.wins + tradeJournal.losses > 0 ? tradeJournal.wins / (tradeJournal.wins + tradeJournal.losses) : 0) : 0;

  const engines = {
    sales: {
      pipeline_value: Math.round(pipelineValue),
      deals_closing_soon: closingSoon.length,
      weighted_value: Math.round(deals.reduce((s: number, d: any) => s + (d.value_usd ?? 0) * ((d.probability ?? 50) / 100), 0)),
      status: `${closingSoon.length} deal${closingSoon.length !== 1 ? 's' : ''} closing this week`,
    },
    trading: {
      open_pnl: Math.round(openPnl),
      today_pnl: Math.round(todayTradingPnl),
      win_rate_today: Math.round(winRateToday * 100) / 100,
      open_positions: positions.length,
      status: `${todayTradingPnl >= 0 ? '+' : ''}$${Math.abs(Math.round(todayTradingPnl))} today, ${Math.round(winRateToday * 100)}% win rate`,
    },
    ops: {
      monthly_burn: Math.round(monthlyBurn),
      active_subscriptions: (allExpenses ?? []).length,
      vs_last_month: 0, // requires historical comparison — set to 0 for now
      status: `${(allExpenses ?? []).length} active subs, $${Math.round(monthlyBurn)}/mo`,
    },
  };

  // Leaks
  const moneyLeaks: any[] = [];

  // Unprotected positions
  const noStopPositions = positions.filter((p: any) => !p.stop_loss);
  if (noStopPositions.length > 0) {
    const exposedValue = noStopPositions.reduce((s: number, p: any) => s + Math.abs((p.entry_price ?? 0) * (p.size ?? 0)), 0);
    moneyLeaks.push({ id: 'no-stoploss', type: 'unprotected_position', text: `${noStopPositions.length} position${noStopPositions.length > 1 ? 's' : ''} with no stop-loss, $${Math.round(exposedValue).toLocaleString()} exposed`, amount: Math.round(exposedValue), severity: 'high' });
  }

  // AI overspend
  const aiSpent = snapshot?.ai_spend_usd ?? 0;
  const aiBudget = 20; // from config
  if (aiSpent > aiBudget * 0.8) {
    moneyLeaks.push({ id: 'ai-overspend', type: 'ai_overspend', text: `AI spend ${Math.round((aiSpent / aiBudget) * 100)}% of daily budget`, amount: Math.round(aiSpent), severity: aiSpent > aiBudget ? 'high' : 'medium' });
  }

  // Stale deals as money leaks (opportunity cost)
  if (staleDeals.length > 0) {
    const staleValue = staleDeals.reduce((s: number, d: any) => s + (d.value_usd ?? 0), 0);
    moneyLeaks.push({ id: 'stale-pipeline', type: 'stale_pipeline', text: `$${Math.round(staleValue).toLocaleString()} pipeline going stale (${staleDeals.length} deal${staleDeals.length > 1 ? 's' : ''})`, amount: Math.round(staleValue), severity: 'high' });
  }

  const totalLeak = moneyLeaks.reduce((s: number, l: any) => s + (l.amount ?? 0), 0);

  // Deploy Capital recommendations
  const deployRecs: any[] = [];

  // Close high-value deals
  for (const d of closingSoon.slice(0, 2)) {
    deployRecs.push({ id: `close-${d.id}`, type: 'close_deal', text: `Close ${d.company} = +$${(d.value_usd ?? 0).toLocaleString()} revenue`, impact: d.value_usd ?? 0, icon: 'DollarSign' });
  }

  // Set stop-losses
  if (noStopPositions.length > 0) {
    const exposedValue = noStopPositions.reduce((s: number, p: any) => s + Math.abs((p.entry_price ?? 0) * (p.size ?? 0)), 0);
    deployRecs.push({ id: 'set-stops', type: 'reduce_risk', text: `Set stop-losses = reduce $${Math.round(exposedValue).toLocaleString()} open risk`, impact: Math.round(exposedValue), icon: 'Shield' });
  }

  deployRecs.sort((a: any, b: any) => b.impact - a.impact);

  // Scorecard
  const { data: weekJournals } = await supabase
    .from('trade_journal')
    .select('*')
    .eq('user_id', userId)
    .gte('date', new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10))
    .order('date');

  const weekTotals = (weekJournals ?? []).reduce((acc: any, j: any) => ({
    wins: acc.wins + (j.wins ?? 0),
    losses: acc.losses + (j.losses ?? 0),
    pnl: acc.pnl + (j.pnl_usd ?? 0),
  }), { wins: 0, losses: 0, pnl: 0 });

  // Best/worst from closed positions this week
  const { data: closedThisWeek } = await supabase
    .from('positions')
    .select('ticker, pnl_usd')
    .eq('user_id', userId)
    .eq('status', 'closed')
    .gte('closed_at', new Date(Date.now() - 7 * 86400000).toISOString())
    .order('pnl_usd', { ascending: false });

  const bestTrade = (closedThisWeek ?? [])[0] ?? null;
  const worstTrade = (closedThisWeek ?? []).length > 0 ? (closedThisWeek ?? [])[(closedThisWeek ?? []).length - 1] : null;

  const scorecard = {
    today: { wins: tradeJournal?.wins ?? 0, losses: tradeJournal?.losses ?? 0, pnl: Math.round(todayTradingPnl) },
    week: { wins: weekTotals.wins, losses: weekTotals.losses, pnl: Math.round(weekTotals.pnl) },
    best_trade: bestTrade ? { ticker: bestTrade.ticker, pnl: Math.round(bestTrade.pnl_usd) } : null,
    worst_trade: worstTrade && worstTrade.pnl_usd < 0 ? { ticker: worstTrade.ticker, pnl: Math.round(worstTrade.pnl_usd) } : null,
    avg_hold_hours: 0, // requires position open/close timestamps with time — deferred
  };

  // Expense Radar
  const categoryMap: Record<string, { amount: number; count: number }> = {};
  for (const e of (allExpenses ?? [])) {
    const cat = e.category ?? 'other';
    if (!categoryMap[cat]) categoryMap[cat] = { amount: 0, count: 0 };
    const monthly = e.frequency === 'weekly' ? (e.amount_usd ?? 0) * 4.33
      : e.frequency === 'annual' ? (e.amount_usd ?? 0) / 12
      : (e.amount_usd ?? 0);
    categoryMap[cat].amount += monthly;
    categoryMap[cat].count++;
  }
  const expenseRadar = Object.entries(categoryMap)
    .map(([category, { amount, count }]) => ({ category, amount: Math.round(amount), count }))
    .sort((a, b) => b.amount - a.amount);

  // Upsert money_intelligence
  await supabase.from('money_intelligence').upsert({
    user_id: userId,
    date: today,
    velocity,
    engines,
    leaks: moneyLeaks,
    deploy: deployRecs.slice(0, 4),
    scorecard,
    expense_radar: expenseRadar,
    computed_at: new Date().toISOString(),
  }, { onConflict: 'user_id,date' });
```

- [ ] **Step 2: Update the return statement to include money stats**

Change the existing return to:

```typescript
  return {
    heroStats, topFive: topFive.length, nextActions: nextActions.length,
    wasteAlerts: wasteAlerts.length, suggestions: newSuggestions.length,
    money: { velocity: velocity.daily_net, leaks: moneyLeaks.length, deploys: deployRecs.length },
  };
```

- [ ] **Step 3: Deploy the updated function**

Run: `supabase functions deploy today-compute --no-verify-jwt`

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/today-compute/index.ts
git commit -m "feat: extend today-compute with money intelligence computation"
```

---

### Task 3: `useMoneySupa` hook

**Files:**
- Create: `src/hooks/useMoneySupa.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useMoneySupa.js
import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useMoneySupa() {
  const [data, setData] = useState({ intelligence: null, loading: true, error: null });
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ intelligence: null, loading: false, error: "Supabase not configured" });
      return;
    }
    try {
      const { data: row, error } = await supabase
        .from("money_intelligence")
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
    if (supabase) {
      const channel = supabase
        .channel("money-intel")
        .on("postgres_changes", { event: "*", schema: "public", table: "money_intelligence" }, () => refresh())
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

  const recompute = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      await fetch(`${supabaseUrl}/functions/v1/today-compute?mode=manual`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${anonKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id }),
      });
      await refresh();
    } catch (e) {
      console.error("[useMoneySupa] recompute failed:", e);
    }
  }, [refresh]);

  return { ...data, refresh, recompute };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useMoneySupa.js
git commit -m "feat: add useMoneySupa hook — precomputed money intelligence + Realtime"
```

---

### Task 4: CapitalVelocityHero component

**Files:**
- Create: `src/components/money/CapitalVelocityHero.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/money/CapitalVelocityHero.jsx
import { TrendingUp, TrendingDown } from "lucide-react";

function Sparkline({ data, width = 200, height = 40 }) {
  if (!data || data.length < 2) return null;
  const max = Math.max(...data.map(Math.abs), 1);
  const mid = height / 2;
  const step = width / (data.length - 1);
  const points = data.map((v, i) => `${i * step},${mid - (v / max) * (height / 2 - 2)}`).join(" ");
  return (
    <svg width={width} height={height} className="overflow-visible">
      <line x1={0} y1={mid} x2={width} y2={mid} stroke="currentColor" strokeOpacity={0.1} />
      <polyline fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" points={points}
        className="text-jarvis-cyan" style={{ strokeDasharray: width * 2, strokeDashoffset: width * 2, animation: "drawLine 400ms ease-out forwards" }} />
    </svg>
  );
}

function StatChip({ label, value, color }) {
  return (
    <span className="chip">
      <span className="text-jarvis-muted">{label}</span>{" "}
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}

export function CapitalVelocityHero({ velocity }) {
  const net = velocity?.daily_net ?? 0;
  const isPositive = net >= 0;
  const color = isPositive ? "text-jarvis-green" : "text-jarvis-red";
  const glowClass = isPositive ? "border-jarvis-green/20 shadow-glow-green" : "border-jarvis-red/20 shadow-glow-red";
  const Icon = isPositive ? TrendingUp : TrendingDown;
  const vsPct = velocity?.vs_last_week_pct ?? 0;

  const fmtUsd = (n) => `${n >= 0 ? "+" : "-"}$${Math.abs(n).toLocaleString()}`;

  if (!velocity || Object.keys(velocity).length === 0) {
    return (
      <div className="glass p-6 border border-jarvis-border">
        <div className="label">Capital Velocity</div>
        <p className="text-sm text-jarvis-muted mt-2">Add deals and trades to see your capital velocity.</p>
      </div>
    );
  }

  return (
    <div className={`glass p-6 border ${glowClass} animate-fadeIn`}>
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="label">Capital Velocity</div>
          <div className="flex items-baseline gap-3 mt-2">
            <span className={`font-display text-4xl tabular-nums ${color}`}>{fmtUsd(net)}</span>
            <span className="text-sm text-jarvis-muted">/day this week</span>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <Icon size={14} className={color} />
            <span className={`text-xs font-semibold ${vsPct >= 0 ? "text-jarvis-green" : "text-jarvis-red"}`}>
              {vsPct >= 0 ? "+" : ""}{vsPct.toFixed(1)}% vs last week
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <StatChip label="Sales" value={fmtUsd(velocity.sales_contribution ?? 0)} color="text-jarvis-blue" />
            <StatChip label="Trading" value={fmtUsd(velocity.trading_contribution ?? 0)} color="text-jarvis-purple" />
            <StatChip label="Costs" value={fmtUsd(velocity.cost_drag ?? 0)} color="text-jarvis-red" />
          </div>
        </div>
        <div className="shrink-0">
          <Sparkline data={velocity.sparkline_7d} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add sparkline draw animation to Tailwind**

Read `tailwind.config.js`. Add to `keyframes`:

```js
drawLine: {
  to: { strokeDashoffset: "0" },
},
```

And to `animation`:

```js
drawLine: "drawLine 400ms ease-out forwards",
```

- [ ] **Step 3: Commit**

```bash
git add src/components/money/CapitalVelocityHero.jsx tailwind.config.js
git commit -m "feat: add CapitalVelocityHero — velocity number + sparkline"
```

---

### Task 5: ThreeEngines component

**Files:**
- Create: `src/components/money/ThreeEngines.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/money/ThreeEngines.jsx
import { Briefcase, TrendingUp, CreditCard } from "lucide-react";

const ENGINE_CONFIG = [
  { key: "sales", label: "Sales Pipeline", Icon: Briefcase, color: "text-jarvis-blue", bgColor: "bg-blue-500/15" },
  { key: "trading", label: "Trading", Icon: TrendingUp, color: "text-jarvis-purple", bgColor: "bg-purple-500/15" },
  { key: "ops", label: "Operations", Icon: CreditCard, color: "text-jarvis-cyan", bgColor: "bg-cyan-500/15" },
];

function fmtUsd(n) {
  if (n == null) return "--";
  return `$${Math.abs(n).toLocaleString()}`;
}

function engineValue(engine, key) {
  if (key === "sales") return fmtUsd(engine?.pipeline_value);
  if (key === "trading") return `${(engine?.open_pnl ?? 0) >= 0 ? "+" : "-"}${fmtUsd(engine?.open_pnl)}`;
  if (key === "ops") return `${fmtUsd(engine?.monthly_burn)}/mo`;
  return "--";
}

export function ThreeEngines({ engines }) {
  if (!engines || Object.keys(engines).length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Three Engines</div>
        <p className="text-sm text-jarvis-muted">Add deals, trades, and expenses to see your engines.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Three Engines</div>
      <div className="space-y-2">
        {ENGINE_CONFIG.map(({ key, label, Icon, color, bgColor }, i) => {
          const engine = engines[key];
          return (
            <div key={key} className="flex items-center gap-3 px-3 py-3 rounded-xl border border-jarvis-border bg-white/[0.02]"
                 style={{ animationDelay: `${i * 100}ms` }}>
              <div className={`w-9 h-9 rounded-lg grid place-items-center shrink-0 ${bgColor}`}>
                <Icon size={16} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs text-jarvis-muted">{label}</div>
                <div className={`text-lg font-semibold tabular-nums ${color}`}>{engineValue(engine, key)}</div>
              </div>
              <div className="text-[11px] text-jarvis-body max-w-[140px] text-right">{engine?.status ?? ""}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/money/ThreeEngines.jsx
git commit -m "feat: add ThreeEngines component — sales, trading, ops at a glance"
```

---

### Task 6: MoneyLeaks component

**Files:**
- Create: `src/components/money/MoneyLeaks.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/money/MoneyLeaks.jsx
import { AlertTriangle, Shield, TrendingDown, CreditCard, Zap } from "lucide-react";

const TYPE_ICON = {
  unused_subscription: CreditCard,
  low_margin_deal: TrendingDown,
  unprotected_position: TrendingDown,
  ai_overspend: Zap,
  stale_pipeline: TrendingDown,
};

const SEVERITY_COLOR = {
  high: "text-jarvis-red",
  medium: "text-jarvis-amber",
  low: "text-jarvis-body",
};

export function MoneyLeaks({ leaks }) {
  if (!leaks || leaks.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Money Leaks</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Shield size={14} />
          <span>No leaks detected — clean finances.</span>
        </div>
      </div>
    );
  }

  const totalLeak = leaks.reduce((s, l) => s + (l.amount ?? 0), 0);

  return (
    <div className="glass p-5">
      <div className="label mb-3">Money Leaks</div>
      <div className="space-y-2">
        {leaks.map((l) => {
          const Icon = TYPE_ICON[l.type] ?? AlertTriangle;
          const color = SEVERITY_COLOR[l.severity] ?? "text-jarvis-body";
          return (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <Icon size={14} className={color} />
              <span className="text-sm text-jarvis-body flex-1">{l.text}</span>
              {l.amount > 0 && <span className="text-xs font-semibold text-jarvis-red tabular-nums">${l.amount.toLocaleString()}</span>}
            </div>
          );
        })}
      </div>
      {totalLeak > 0 && (
        <div className="mt-3 pt-3 border-t border-jarvis-border flex items-center justify-between">
          <span className="text-xs text-jarvis-muted">Total exposure</span>
          <span className="text-sm font-semibold text-jarvis-red tabular-nums">${totalLeak.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/money/MoneyLeaks.jsx
git commit -m "feat: add MoneyLeaks component — financial waste detection"
```

---

### Task 7: DeployCapital component

**Files:**
- Create: `src/components/money/DeployCapital.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/money/DeployCapital.jsx
import { DollarSign, Scissors, Shield, Check } from "lucide-react";

const ICON_MAP = { DollarSign, Scissors, Shield };

export function DeployCapital({ deploy }) {
  if (!deploy || deploy.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Deploy Capital</div>
        <p className="text-sm text-jarvis-muted">Recommendations appear as you add deals and expenses.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Deploy Capital</div>
      <div className="space-y-2">
        {deploy.map((d) => {
          const Icon = ICON_MAP[d.icon] ?? DollarSign;
          return (
            <div key={d.id} className="flex items-start gap-3 px-3 py-3 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className="w-8 h-8 rounded-lg bg-jarvis-green/10 grid place-items-center shrink-0">
                <Icon size={14} className="text-jarvis-green" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink">{d.text}</div>
                <div className="text-[10px] text-jarvis-green font-semibold mt-0.5 tabular-nums">
                  Impact: ${(d.impact ?? 0).toLocaleString()}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/money/DeployCapital.jsx
git commit -m "feat: add DeployCapital component — Stark-style capital recommendations"
```

---

### Task 8: TradingScorecard component

**Files:**
- Create: `src/components/money/TradingScorecard.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/money/TradingScorecard.jsx
import { Trophy, Target } from "lucide-react";

function WinBar({ wins, losses }) {
  const total = wins + losses;
  if (total === 0) return null;
  const pct = Math.round((wins / total) * 100);
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
        <div className="h-full rounded-full bg-jarvis-green" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] text-jarvis-muted tabular-nums">{pct}%</span>
    </div>
  );
}

function PnlChip({ label, pnl }) {
  const color = pnl >= 0 ? "text-jarvis-green" : "text-jarvis-red";
  return (
    <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
      <span className="text-xs text-jarvis-muted">{label}</span>
      <span className={`text-sm font-semibold tabular-nums ${color}`}>
        {pnl >= 0 ? "+" : ""}${Math.abs(pnl).toLocaleString()}
      </span>
    </div>
  );
}

export function TradingScorecard({ scorecard }) {
  if (!scorecard || Object.keys(scorecard).length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Trading Scorecard</div>
        <p className="text-sm text-jarvis-muted">Log your first trade to see your scorecard.</p>
      </div>
    );
  }

  const today = scorecard.today ?? {};
  const week = scorecard.week ?? {};

  return (
    <div className="glass p-5">
      <div className="label mb-3">Trading Scorecard</div>
      <div className="space-y-3">
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-jarvis-muted">Today</span>
            <span className="text-xs text-jarvis-body">{today.wins ?? 0}W {today.losses ?? 0}L</span>
          </div>
          <PnlChip label="P&L" pnl={today.pnl ?? 0} />
          <WinBar wins={today.wins ?? 0} losses={today.losses ?? 0} />
        </div>
        <div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-jarvis-muted">This Week</span>
            <span className="text-xs text-jarvis-body">{week.wins ?? 0}W {week.losses ?? 0}L</span>
          </div>
          <PnlChip label="P&L" pnl={week.pnl ?? 0} />
          <WinBar wins={week.wins ?? 0} losses={week.losses ?? 0} />
        </div>
        {(scorecard.best_trade || scorecard.worst_trade) && (
          <div className="flex items-center gap-2 pt-2 border-t border-jarvis-border">
            {scorecard.best_trade && (
              <span className="chip text-[10px]">
                <Trophy size={10} className="text-jarvis-green inline mr-1" />
                {scorecard.best_trade.ticker} +${Math.abs(scorecard.best_trade.pnl).toLocaleString()}
              </span>
            )}
            {scorecard.worst_trade && (
              <span className="chip text-[10px]">
                <Target size={10} className="text-jarvis-red inline mr-1" />
                {scorecard.worst_trade.ticker} -${Math.abs(scorecard.worst_trade.pnl).toLocaleString()}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/money/TradingScorecard.jsx
git commit -m "feat: add TradingScorecard — win rate, P&L, best/worst trades"
```

---

### Task 9: ExpenseRadar component

**Files:**
- Create: `src/components/money/ExpenseRadar.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/money/ExpenseRadar.jsx
export function ExpenseRadar({ expenseRadar }) {
  if (!expenseRadar || expenseRadar.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Monthly Burn</div>
        <p className="text-sm text-jarvis-muted">Add recurring expenses to track your burn rate.</p>
      </div>
    );
  }

  const maxAmount = Math.max(...expenseRadar.map((e) => e.amount), 1);
  const total = expenseRadar.reduce((s, e) => s + e.amount, 0);

  return (
    <div className="glass p-5">
      <div className="label mb-3">Monthly Burn</div>
      <div className="space-y-2">
        {expenseRadar.map((e, i) => {
          const pct = (e.amount / maxAmount) * 100;
          return (
            <div key={e.category} className="flex items-center gap-3">
              <span className="text-xs text-jarvis-body w-28 shrink-0 truncate">{e.category}</span>
              <div className="flex-1 h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-jarvis-cyan/60"
                  style={{
                    width: `${pct}%`,
                    animation: `growBar 300ms ease-out ${i * 50}ms both`,
                  }}
                />
              </div>
              <span className="text-xs text-jarvis-ink font-semibold tabular-nums w-16 text-right">${e.amount}</span>
              <span className="text-[10px] text-jarvis-muted w-8 text-right">{e.count}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-jarvis-border flex items-center justify-between">
        <span className="text-xs text-jarvis-muted">Total</span>
        <span className="text-sm font-semibold text-jarvis-ink tabular-nums">${total.toLocaleString()}/mo</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add growBar animation to Tailwind**

Read `tailwind.config.js`, add to `keyframes`:
```js
growBar: {
  from: { width: "0%" },
  to: { width: "var(--tw-width, 100%)" },
},
```
And to `animation`:
```js
growBar: "growBar 300ms ease-out forwards",
```

Note: The CSS animation in the component uses inline `style` with the actual width, so the keyframe just needs from:0%. The inline style's `animation-fill-mode: both` handles the rest.

- [ ] **Step 3: Commit**

```bash
git add src/components/money/ExpenseRadar.jsx tailwind.config.js
git commit -m "feat: add ExpenseRadar — monthly burn by category with animated bars"
```

---

### Task 10: Wire Money.jsx orchestrator

**Files:**
- Modify: `src/views/Money.jsx` (full rewrite)

- [ ] **Step 1: Read the existing Money.jsx, then rewrite it**

```jsx
// src/views/Money.jsx
import { useMoneySupa } from "../hooks/useMoneySupa.js";
import { CapitalVelocityHero } from "../components/money/CapitalVelocityHero.jsx";
import { ThreeEngines } from "../components/money/ThreeEngines.jsx";
import { MoneyLeaks } from "../components/money/MoneyLeaks.jsx";
import { DeployCapital } from "../components/money/DeployCapital.jsx";
import { TradingScorecard } from "../components/money/TradingScorecard.jsx";
import { ExpenseRadar } from "../components/money/ExpenseRadar.jsx";

export default function Money() {
  const { intelligence } = useMoneySupa();

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <CapitalVelocityHero velocity={intelligence?.velocity} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ThreeEngines engines={intelligence?.engines} />
          <MoneyLeaks leaks={intelligence?.leaks} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <DeployCapital deploy={intelligence?.deploy} />
          <TradingScorecard scorecard={intelligence?.scorecard} />
        </div>

        <ExpenseRadar expenseRadar={intelligence?.expense_radar} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `npx vite build`
Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/views/Money.jsx
git commit -m "feat: wire Money command center — 6 modules with precomputed intelligence"
```

---

### Task 11: Apply migration + deploy + final verify

**Files:** None new

- [ ] **Step 1: Apply the migration**

Run: `supabase db query --linked -f supabase/migrations/20260412_money_intelligence.sql`

- [ ] **Step 2: Deploy the updated Edge Function**

Run: `supabase functions deploy today-compute --no-verify-jwt`

- [ ] **Step 3: Verify full build**

Run: `npx vite build`
Expected: 0 errors.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Money Command Center — M2 Batch 2 page 2 of 6"
```
