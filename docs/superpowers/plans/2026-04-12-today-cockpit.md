# Today Cockpit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Today page into a 60-second daily cockpit with 7 modules pulling from Supabase (deals, positions, follow-ups, habits) and jarvisd (calendar, brief, cost).

**Architecture:** Supabase is the shared data backbone for structured business data. jarvisd provides local intelligence (calendar, LLM, vault, skills). Frontend reads both via hooks. Each module is a self-contained glass panel component.

**Tech Stack:** React, Tailwind (jarvis theme), Supabase JS client, jarvisd REST API, Lucide icons

**Spec:** `docs/superpowers/specs/2026-04-12-m2b2-today-cockpit-design.md`

---

### Task 1: Supabase Client + Migration

**Files:**
- Create: `src/lib/supabase.js`
- Create: `supabase/migrations/20260412_m2b2_today_cockpit.sql`

- [ ] **Step 1: Create Supabase client singleton**

```js
// src/lib/supabase.js
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn('[supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set — Supabase features disabled');
}

export const supabase = url && key ? createClient(url, key) : null;
```

- [ ] **Step 2: Create the migration file with all 11 new tables**

Write `supabase/migrations/20260412_m2b2_today_cockpit.sql` containing: `contacts`, `deals`, `follow_ups`, `positions`, `watchlist`, `trade_journal`, `daily_snapshot`, `expenses`, `health_log`, `habits`, `jarvis_suggestions`. Each table has `user_id` FK, RLS enabled, and an owner-only policy. Use the exact schemas from the spec.

```sql
-- M2 Batch 2: Today Cockpit — shared data tables
-- Run in Supabase SQL Editor or via `supabase db push`

-- contacts must be created before deals (FK reference)
create table if not exists contacts (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  company         text,
  role            text,
  email           text,
  phone           text,
  last_interaction timestamptz,
  follow_up_due   date,
  notes           text,
  created_at      timestamptz default now()
);
alter table contacts enable row level security;
create policy "contacts_owner" on contacts for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists deals (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company       text not null,
  contact_name  text,
  contact_id    uuid references contacts(id),
  stage         text not null default 'prospect',
  value_usd     real not null default 0,
  probability   int not null default 50,
  close_date    date,
  last_touch    timestamptz default now(),
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table deals enable row level security;
create policy "deals_owner" on deals for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists follow_ups (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete set null,
  action      text not null,
  due_date    date not null,
  status      text not null default 'pending',
  priority    text not null default 'normal',
  completed_at timestamptz,
  notes       text,
  created_at  timestamptz default now()
);
alter table follow_ups enable row level security;
create policy "follow_ups_owner" on follow_ups for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists positions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker      text not null,
  side        text not null default 'long',
  entry_price real not null,
  size        real not null,
  current_price real,
  stop_loss   real,
  target      real,
  status      text not null default 'open',
  pnl_usd     real not null default 0,
  opened_at   timestamptz default now(),
  closed_at   timestamptz,
  notes       text
);
alter table positions enable row level security;
create policy "positions_owner" on positions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists watchlist (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker      text not null,
  alert_price real,
  direction   text,
  notes       text,
  added_at    timestamptz default now()
);
alter table watchlist enable row level security;
create policy "watchlist_owner" on watchlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists trade_journal (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  pnl_usd     real not null default 0,
  wins        int not null default 0,
  losses      int not null default 0,
  notes       text,
  lessons     text,
  created_at  timestamptz default now(),
  unique(user_id, date)
);
alter table trade_journal enable row level security;
create policy "trade_journal_owner" on trade_journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists daily_snapshot (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date            date not null default current_date,
  open_deals      int not null default 0,
  pipeline_value  real not null default 0,
  deals_touched   int not null default 0,
  trading_pnl     real not null default 0,
  trades_taken    int not null default 0,
  meetings_count  int not null default 0,
  tasks_completed int not null default 0,
  focus_hours     real not null default 0,
  energy_score    int,
  sleep_hours     real,
  ai_spend_usd    real not null default 0,
  notes           text,
  created_at      timestamptz default now(),
  unique(user_id, date)
);
alter table daily_snapshot enable row level security;
create policy "daily_snapshot_owner" on daily_snapshot for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists expenses (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  amount_usd  real not null,
  category    text not null default 'other',
  frequency   text not null default 'monthly',
  next_due    date,
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz default now()
);
alter table expenses enable row level security;
create policy "expenses_owner" on expenses for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists health_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  sleep_hours real,
  energy      int,
  workout     boolean default false,
  workout_type text,
  notes       text,
  created_at  timestamptz default now(),
  unique(user_id, date)
);
alter table health_log enable row level security;
create policy "health_log_owner" on health_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists habits (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  frequency       text not null default 'daily',
  current_streak  int not null default 0,
  best_streak     int not null default 0,
  last_done       date,
  active          boolean not null default true,
  created_at      timestamptz default now()
);
alter table habits enable row level security;
create policy "habits_owner" on habits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists jarvis_suggestions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null,
  suggestion  text not null,
  context     jsonb,
  acted_on    boolean,
  outcome     text,
  created_at  timestamptz default now()
);
alter table jarvis_suggestions enable row level security;
create policy "jarvis_suggestions_owner" on jarvis_suggestions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Indexes for Today cockpit queries
create index if not exists idx_deals_user_stage on deals(user_id, stage);
create index if not exists idx_follow_ups_user_status on follow_ups(user_id, status, due_date);
create index if not exists idx_positions_user_status on positions(user_id, status);
create index if not exists idx_daily_snapshot_user_date on daily_snapshot(user_id, date);
create index if not exists idx_health_log_user_date on health_log(user_id, date);
create index if not exists idx_habits_user_active on habits(user_id, active);
create index if not exists idx_expenses_user_active on expenses(user_id, active);
```

- [ ] **Step 3: Run the migration**

Run: `supabase db push` or paste the SQL into the Supabase SQL Editor.
Expected: 11 tables created, RLS enabled, policies applied.

- [ ] **Step 4: Verify .env has Supabase credentials**

Check that `/Users/Jjarvis/ai-command-center/.env` contains valid `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase.js supabase/migrations/20260412_m2b2_today_cockpit.sql
git commit -m "feat: add Supabase client + 11 data tables for Today cockpit"
```

---

### Task 2: Supabase Data Hook

**Files:**
- Create: `src/hooks/useTodaySupa.js`

- [ ] **Step 1: Create the hook that fetches all Supabase data for the Today page**

```js
// src/hooks/useTodaySupa.js
import { useCallback, useEffect, useState } from "react";
import { supabase } from "../lib/supabase.js";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function useTodaySupa() {
  const [data, setData] = useState({
    deals: [],
    followUps: [],
    positions: [],
    habits: [],
    expenses: [],
    tradeJournal: null,
    loading: true,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData((d) => ({ ...d, loading: false, error: "Supabase not configured" }));
      return;
    }
    try {
      const today = todayIso();
      const [dealsRes, fuRes, posRes, habitsRes, expRes, tjRes] = await Promise.all([
        supabase.from("deals").select("*").not("stage", "in", '("closed_won","closed_lost")').order("value_usd", { ascending: false }),
        supabase.from("follow_ups").select("*, deals(company), contacts(name)").in("status", ["pending", "waiting"]).order("due_date"),
        supabase.from("positions").select("*").eq("status", "open").order("pnl_usd", { ascending: false }),
        supabase.from("habits").select("*").eq("active", true).order("name"),
        supabase.from("expenses").select("*").eq("active", true).lte("next_due", new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)).order("next_due"),
        supabase.from("trade_journal").select("*").eq("date", today).maybeSingle(),
      ]);

      setData({
        deals: dealsRes.data ?? [],
        followUps: fuRes.data ?? [],
        positions: posRes.data ?? [],
        habits: habitsRes.data ?? [],
        expenses: expRes.data ?? [],
        tradeJournal: tjRes.data,
        loading: false,
        error: null,
      });
    } catch (e) {
      setData((d) => ({ ...d, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { ...data, refresh };
}
```

- [ ] **Step 2: Verify the hook compiles**

Run: `npm run dev` — check browser console for errors. Expected: no crash. Data arrays will be empty (no rows yet).

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useTodaySupa.js
git commit -m "feat: add useTodaySupa hook for Today cockpit data"
```

---

### Task 3: MorningBriefHero Component

**Files:**
- Create: `src/components/today/MorningBriefHero.jsx`

- [ ] **Step 1: Create the hero component**

```jsx
// src/components/today/MorningBriefHero.jsx
import { RefreshCw, Loader2 } from "lucide-react";

function fmtDate() {
  return new Date().toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function StatChip({ label, value, color = "text-jarvis-cyan" }) {
  return (
    <span className="chip">
      <span className="text-jarvis-muted">{label}</span>{" "}
      <span className={`font-semibold ${color}`}>{value}</span>
    </span>
  );
}

export function MorningBriefHero({
  brief,
  meetingCount,
  pipelineValue,
  tradingPnl,
  followUpsDue,
  budgetRemaining,
  onRegenerate,
  regenerating,
}) {
  const pnlColor = tradingPnl > 0 ? "text-jarvis-green" : tradingPnl < 0 ? "text-jarvis-red" : "text-jarvis-body";
  const fmtUsd = (n) => n == null ? "--" : `$${Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="glass p-6 border border-jarvis-cyan/20 shadow-glow-cyan animate-fadeIn">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-jarvis-ink">{fmtDate()}</h1>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <StatChip label="Meetings" value={meetingCount ?? 0} />
            <StatChip label="Pipeline" value={fmtUsd(pipelineValue)} color="text-jarvis-blue" />
            <StatChip label="P&L" value={`${tradingPnl >= 0 ? "+" : ""}${fmtUsd(tradingPnl)}`} color={pnlColor} />
            <StatChip label="Follow-ups" value={followUpsDue ?? 0} color={followUpsDue > 0 ? "text-jarvis-amber" : "text-jarvis-green"} />
            <StatChip label="Budget" value={fmtUsd(budgetRemaining)} />
          </div>
        </div>
        <button
          type="button"
          onClick={onRegenerate}
          disabled={regenerating}
          className="shrink-0 px-3 py-2 rounded-xl text-xs bg-white/5 hover:bg-white/10 text-jarvis-body hover:text-jarvis-ink flex items-center gap-1.5 transition"
        >
          {regenerating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Brief
        </button>
      </div>
      {brief?.narrative && (
        <p className="text-sm text-jarvis-body mt-4 leading-relaxed">{brief.narrative}</p>
      )}
      {!brief?.narrative && (
        <p className="text-sm text-jarvis-muted mt-4 italic">No brief generated yet — click Brief to generate.</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add fadeIn animation to Tailwind config**

Check if `animate-fadeIn` exists in `tailwind.config.js`. If not, add:

```js
// In tailwind.config.js → theme.extend.animation
fadeIn: "fadeIn 200ms ease-out",
// In theme.extend.keyframes
fadeIn: { from: { opacity: "0", transform: "translateY(4px)" }, to: { opacity: "1", transform: "translateY(0)" } },
```

- [ ] **Step 3: Commit**

```bash
git add src/components/today/MorningBriefHero.jsx tailwind.config.js
git commit -m "feat: add MorningBriefHero component for Today cockpit"
```

---

### Task 4: TopFiveFocus Component

**Files:**
- Create: `src/components/today/TopFiveFocus.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/today/TopFiveFocus.jsx
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

function roleBadge(type) {
  switch (type) {
    case "deal": return <span className="chip text-[10px] bg-blue-500/15 text-jarvis-blue">Sales</span>;
    case "position": return <span className="chip text-[10px] bg-purple-500/15 text-jarvis-purple">Trading</span>;
    case "followup": return <span className="chip text-[10px] bg-cyan-500/15 text-jarvis-cyan">Action</span>;
    default: return null;
  }
}

function scoreItem(item) {
  if (item.type === "deal") return (item.value_usd ?? 0) * ((item.probability ?? 50) / 100);
  if (item.type === "position") return Math.abs(item.pnl_usd ?? 0);
  if (item.type === "followup") return item.priority === "urgent" ? 100000 : item.priority === "high" ? 50000 : 1000;
  return 0;
}

export function TopFiveFocus({ deals, positions, followUps }) {
  const [expanded, setExpanded] = useState(null);

  const items = [
    ...deals.slice(0, 5).map((d) => ({ type: "deal", id: d.id, label: `${d.company} — ${d.stage}`, value: `$${(d.value_usd ?? 0).toLocaleString()}`, notes: d.notes, value_usd: d.value_usd, probability: d.probability })),
    ...positions.slice(0, 3).map((p) => ({ type: "position", id: p.id, label: `${p.ticker} ${p.side}`, value: `${p.pnl_usd >= 0 ? "+" : ""}$${(p.pnl_usd ?? 0).toLocaleString()}`, notes: p.notes, pnl_usd: p.pnl_usd })),
    ...followUps.filter((f) => f.priority === "urgent" || f.priority === "high").slice(0, 3).map((f) => ({ type: "followup", id: f.id, label: f.action, value: f.priority, notes: f.notes, priority: f.priority })),
  ]
    .sort((a, b) => scoreItem(b) - scoreItem(a))
    .slice(0, 5);

  if (items.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Today's Focus</div>
        <p className="text-sm text-jarvis-muted">Add your first deal or position to see priorities here.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Today's Focus</div>
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={item.id} className="rounded-xl border border-jarvis-border bg-white/[0.02] overflow-hidden"
               style={{ animationDelay: `${(i + 1) * 100}ms` }}>
            <button
              type="button"
              onClick={() => setExpanded(expanded === item.id ? null : item.id)}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
            >
              <span className="text-jarvis-cyan font-semibold text-sm w-5 text-center">{i + 1}</span>
              <span className="text-sm text-jarvis-ink truncate flex-1">{item.label}</span>
              {roleBadge(item.type)}
              <span className="text-xs text-jarvis-body font-semibold tabular-nums">{item.value}</span>
              {expanded === item.id ? <ChevronUp size={12} className="text-jarvis-muted" /> : <ChevronDown size={12} className="text-jarvis-muted" />}
            </button>
            {expanded === item.id && item.notes && (
              <div className="px-3 pb-3 text-xs text-jarvis-body">{item.notes}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/today/TopFiveFocus.jsx
git commit -m "feat: add TopFiveFocus component — Buffett-style priority ranking"
```

---

### Task 5: NextBestActions Component

**Files:**
- Create: `src/components/today/NextBestActions.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/today/NextBestActions.jsx
import { Phone, TrendingUp, Clock, Heart, Check, BellOff } from "lucide-react";

function ActionCard({ icon: Icon, iconColor, text, age, onDone, onSnooze }) {
  const isOverdue = age && age > 2;
  return (
    <div className={`rounded-xl border bg-white/[0.02] p-3 flex items-start gap-3 ${isOverdue ? "border-jarvis-amber/40 shadow-glow-amber" : "border-jarvis-border"}`}>
      <div className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${iconColor}`}>
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-jarvis-ink">{text}</div>
        {age != null && <div className="text-[10px] text-jarvis-muted mt-0.5">{age}d ago</div>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onDone && (
          <button onClick={onDone} className="p-1.5 rounded-lg hover:bg-jarvis-green/10 text-jarvis-muted hover:text-jarvis-green transition" title="Done">
            <Check size={12} />
          </button>
        )}
        {onSnooze && (
          <button onClick={onSnooze} className="p-1.5 rounded-lg hover:bg-jarvis-amber/10 text-jarvis-muted hover:text-jarvis-amber transition" title="Snooze">
            <BellOff size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

function daysSince(ts) {
  if (!ts) return null;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

export function NextBestActions({ deals, positions, habits, calendarGaps, onFollowUpDone, onFollowUpSnooze }) {
  const actions = [];

  // Stale deals (no touch in 3+ days)
  for (const d of deals) {
    const age = daysSince(d.last_touch);
    if (age != null && age >= 3) {
      actions.push({ id: `deal-${d.id}`, icon: Phone, iconColor: "bg-blue-500/15 text-jarvis-blue", text: `Follow up with ${d.company}`, age, dealId: d.id });
    }
  }

  // Positions with no stop-loss
  for (const p of positions) {
    if (!p.stop_loss) {
      actions.push({ id: `pos-${p.id}`, icon: TrendingUp, iconColor: "bg-purple-500/15 text-jarvis-purple", text: `Set stop-loss for ${p.ticker}`, age: null });
    }
  }

  // Calendar gaps
  if (calendarGaps > 0) {
    actions.push({ id: "cal-gap", icon: Clock, iconColor: "bg-cyan-500/15 text-jarvis-cyan", text: `${calendarGaps} open hour${calendarGaps > 1 ? "s" : ""} — block for deep work`, age: null });
  }

  // Habits not done today
  const today = new Date().toISOString().slice(0, 10);
  for (const h of habits) {
    if (h.last_done !== today) {
      actions.push({ id: `habit-${h.id}`, icon: Heart, iconColor: "bg-green-500/15 text-jarvis-green", text: `Log: ${h.name}`, age: null });
    }
  }

  const top4 = actions.slice(0, 4);

  if (top4.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Next Best Move</div>
        <p className="text-sm text-jarvis-muted">Actions will appear as you add deals, positions, and habits.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Next Best Move</div>
      <div className="space-y-2">
        {top4.map((a, i) => (
          <div key={a.id} style={{ animationDelay: `${(i + 1) * 100}ms` }}>
            <ActionCard
              icon={a.icon}
              iconColor={a.iconColor}
              text={a.text}
              age={a.age}
              onDone={a.dealId ? () => onFollowUpDone?.(a.dealId) : undefined}
              onSnooze={a.dealId ? () => onFollowUpSnooze?.(a.dealId) : undefined}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/today/NextBestActions.jsx
git commit -m "feat: add NextBestActions component — Stark-style action cards"
```

---

### Task 6: TimeBlocks Component (refactor from current Today.jsx)

**Files:**
- Create: `src/components/today/TimeBlocks.jsx`

- [ ] **Step 1: Extract the timeline into its own component**

The current `Today.jsx` renders a vertical list of TodayCard items. Refactor the calendar event + focus block rendering into a horizontal timeline component. Keep the existing `TodayCard` logic for the event cards, but wrap it in a `TimeBlocks` container that shows a 6am–10pm horizontal rail with a current-time indicator.

```jsx
// src/components/today/TimeBlocks.jsx
import { useState } from "react";
import { CalendarClock, Target, MapPin, AlertTriangle, X, Loader2, Plus } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  catch { return "--:--"; }
}

function currentTimePercent() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  const start = 6 * 60;  // 6am
  const end = 22 * 60;   // 10pm
  return Math.max(0, Math.min(100, ((mins - start) / (end - start)) * 100));
}

export function TimeBlocks({ items, onRefresh }) {
  const [deleting, setDeleting] = useState(null);
  const pct = currentTimePercent();

  const handleDelete = async (id) => {
    setDeleting(id);
    try { await jarvis.deleteFocusBlock(id); onRefresh?.(); }
    catch { /* silent */ }
    finally { setDeleting(null); }
  };

  if (!items || items.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Schedule</div>
        <p className="text-sm text-jarvis-muted">No events today. Connect Apple Calendar in Settings, or add focus blocks.</p>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Schedule</div>
      {/* Time rail indicator */}
      <div className="relative h-1.5 rounded-full bg-white/5 mb-4">
        <div className="absolute top-0 left-0 h-full rounded-full bg-jarvis-cyan/30" style={{ width: `${pct}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-jarvis-cyan shadow-glow-cyan animate-pulse" style={{ left: `${pct}%` }} />
      </div>
      <div className="space-y-2">
        {items.map((item) => {
          const isFocus = item.kind === "focus";
          const hasConflict = Array.isArray(item.conflictsWith) && item.conflictsWith.length > 0;
          return (
            <div key={item.id} className={`flex items-center gap-3 px-3 py-2 rounded-xl border transition ${hasConflict ? "border-jarvis-red/40 bg-jarvis-red/5" : "border-jarvis-border bg-white/[0.02]"}`}>
              <div className="w-16 shrink-0 text-right">
                <div className="text-[12px] font-semibold text-jarvis-ink tabular-nums">{fmtTime(item.start)}</div>
                <div className="text-[10px] text-jarvis-muted tabular-nums">{fmtTime(item.end)}</div>
              </div>
              <div className="w-px h-8 bg-jarvis-border" />
              <div className="flex-1 min-w-0 flex items-center gap-2">
                {isFocus ? <Target size={12} className="text-jarvis-cyan shrink-0" /> : <CalendarClock size={12} className="text-jarvis-body shrink-0" />}
                <span className="text-sm text-jarvis-ink truncate">{item.title}</span>
                {item.location && <span className="text-[10px] text-jarvis-muted flex items-center gap-0.5"><MapPin size={9} />{item.location}</span>}
                {hasConflict && <AlertTriangle size={11} className="text-jarvis-red shrink-0" />}
              </div>
              {isFocus && (
                <button onClick={() => handleDelete(item.id)} disabled={deleting === item.id} className="p-1 rounded-lg text-jarvis-muted hover:text-jarvis-red transition">
                  {deleting === item.id ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
                </button>
              )}
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
git add src/components/today/TimeBlocks.jsx
git commit -m "feat: add TimeBlocks component with current-time indicator"
```

---

### Task 7: WaitingOn Component

**Files:**
- Create: `src/components/today/WaitingOn.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/today/WaitingOn.jsx
import { Clock, Bell } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

function daysSince(ts) {
  if (!ts) return 0;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

function ageColor(days) {
  if (days >= 7) return "text-jarvis-red";
  if (days >= 3) return "text-jarvis-amber";
  return "text-jarvis-green";
}

export function WaitingOn({ followUps, onRefresh }) {
  const waiting = followUps.filter((f) => f.status === "waiting");

  const nudge = async (fu) => {
    if (!supabase) return;
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    await supabase.from("follow_ups").insert({
      deal_id: fu.deal_id,
      contact_id: fu.contact_id,
      action: `Nudge: ${fu.action}`,
      due_date: tomorrow,
      priority: "high",
    });
    onRefresh?.();
  };

  if (waiting.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Waiting On</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Clock size={14} />
          <span>Nothing pending — nice.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Waiting On</div>
      <div className="space-y-2">
        {waiting.map((fu) => {
          const days = daysSince(fu.created_at);
          return (
            <div key={fu.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-jarvis-ink truncate">{fu.action}</div>
                <div className="text-[10px] text-jarvis-muted mt-0.5">
                  {fu.contacts?.name ?? fu.deals?.company ?? ""}
                  {" · "}
                  <span className={ageColor(days)}>{days}d waiting</span>
                </div>
              </div>
              <button onClick={() => nudge(fu)} className="p-1.5 rounded-lg hover:bg-jarvis-amber/10 text-jarvis-muted hover:text-jarvis-amber transition" title="Nudge">
                <Bell size={12} />
              </button>
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
git add src/components/today/WaitingOn.jsx
git commit -m "feat: add WaitingOn component with nudge action"
```

---

### Task 8: WasteDetector Component

**Files:**
- Create: `src/components/today/WasteDetector.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/today/WasteDetector.jsx
import { AlertTriangle, Shield, Calendar, TrendingDown, CreditCard, Flame } from "lucide-react";

function daysSince(ts) {
  if (!ts) return 999;
  return Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
}

export function WasteDetector({ deals, positions, expenses, habits, calendarItems }) {
  const alerts = [];

  // Meetings with no description/notes
  const emptyMeetings = (calendarItems ?? []).filter((e) => e.kind !== "focus" && !e.notes && !e.description);
  if (emptyMeetings.length > 0) {
    const totalMin = emptyMeetings.reduce((s, e) => {
      const dur = (new Date(e.end) - new Date(e.start)) / 60000;
      return s + (dur > 0 ? dur : 30);
    }, 0);
    alerts.push({ id: "no-agenda", icon: Calendar, text: `${Math.round(totalMin)}min of meetings with no agenda`, color: "text-jarvis-amber" });
  }

  // Stale deals (>7 days no touch)
  const stale = deals.filter((d) => daysSince(d.last_touch) > 7);
  if (stale.length > 0) {
    alerts.push({ id: "stale-deals", icon: TrendingDown, text: `${stale.length} deal${stale.length > 1 ? "s" : ""} going stale (7+ days)`, color: "text-jarvis-red" });
  }

  // Expenses due this week
  for (const exp of expenses) {
    alerts.push({ id: `exp-${exp.id}`, icon: CreditCard, text: `$${exp.amount_usd} due: ${exp.name}`, color: "text-jarvis-amber" });
  }

  // Positions with no stop-loss
  const noStop = positions.filter((p) => !p.stop_loss);
  if (noStop.length > 0) {
    alerts.push({ id: "no-stoploss", icon: TrendingDown, text: `${noStop.length} position${noStop.length > 1 ? "s" : ""} with no stop-loss`, color: "text-jarvis-red" });
  }

  // Broken habit streaks
  const today = new Date().toISOString().slice(0, 10);
  for (const h of habits) {
    if (h.current_streak > 0 && h.last_done && h.last_done < today) {
      const missed = daysSince(h.last_done + "T00:00:00");
      if (missed >= 2) {
        alerts.push({ id: `habit-${h.id}`, icon: Flame, text: `${h.name} streak broken after ${h.current_streak}d`, color: "text-jarvis-amber" });
      }
    }
  }

  if (alerts.length === 0) {
    return (
      <div className="glass p-5">
        <div className="label mb-3">Waste Detector</div>
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Shield size={14} />
          <span>No waste detected — clean day.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5">
      <div className="label mb-3">Waste Detector</div>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-xl border border-jarvis-border bg-white/[0.02]">
            <a.icon size={14} className={a.color} />
            <span className="text-sm text-jarvis-body">{a.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/today/WasteDetector.jsx
git commit -m "feat: add WasteDetector component — surface time/money/attention leaks"
```

---

### Task 9: EndOfDayReview Component

**Files:**
- Create: `src/components/today/EndOfDayReview.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/today/EndOfDayReview.jsx
import { useState } from "react";
import { Moon, Send, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabase.js";

export function EndOfDayReview({ tradeJournal, onSaved }) {
  const [energy, setEnergy] = useState(null);
  const [sleep, setSleep] = useState("");
  const [tradingNotes, setTradingNotes] = useState(tradeJournal?.notes ?? "");
  const [wins, setWins] = useState("");
  const [workout, setWorkout] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const submit = async () => {
    if (!supabase) return;
    setSaving(true);
    const today = new Date().toISOString().slice(0, 10);
    try {
      // Upsert health_log
      await supabase.from("health_log").upsert({
        date: today,
        energy: energy,
        sleep_hours: sleep ? parseFloat(sleep) : null,
        workout,
      }, { onConflict: "user_id,date" });

      // Upsert daily_snapshot
      await supabase.from("daily_snapshot").upsert({
        date: today,
        energy_score: energy,
        sleep_hours: sleep ? parseFloat(sleep) : null,
        notes: wins || null,
      }, { onConflict: "user_id,date" });

      // Upsert trade_journal
      if (tradingNotes) {
        await supabase.from("trade_journal").upsert({
          date: today,
          notes: tradingNotes,
          pnl_usd: tradeJournal?.pnl_usd ?? 0,
          wins: tradeJournal?.wins ?? 0,
          losses: tradeJournal?.losses ?? 0,
        }, { onConflict: "user_id,date" });
      }

      setSaved(true);
      onSaved?.();
    } catch (e) {
      console.error("EOD save failed:", e);
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <div className="glass p-5 border border-jarvis-purple/20">
        <div className="flex items-center gap-2 text-sm text-jarvis-green">
          <Moon size={14} />
          <span>Day logged. Rest well.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-5 border border-jarvis-purple/20 animate-slideUp">
      <div className="label mb-4">End of Day Review</div>

      {/* Energy score */}
      <div className="mb-4">
        <div className="text-xs text-jarvis-muted mb-2">Energy level</div>
        <div className="flex gap-1">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              onClick={() => setEnergy(n)}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${energy === n ? "bg-jarvis-cyan/20 text-jarvis-cyan border border-jarvis-cyan/40" : "bg-white/5 text-jarvis-muted hover:bg-white/10 border border-transparent"}`}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Sleep + workout row */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <div className="text-xs text-jarvis-muted mb-1">Sleep (hours)</div>
          <input
            type="number"
            step="0.5"
            min="0"
            max="14"
            value={sleep}
            onChange={(e) => setSleep(e.target.value)}
            placeholder="7.5"
            className="w-full px-3 py-2 rounded-xl bg-white/5 border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan/50"
          />
        </div>
        <div>
          <div className="text-xs text-jarvis-muted mb-1">Workout</div>
          <button
            onClick={() => setWorkout(!workout)}
            className={`w-full px-3 py-2 rounded-xl text-sm font-medium transition ${workout ? "bg-jarvis-green/15 text-jarvis-green border border-jarvis-green/30" : "bg-white/5 text-jarvis-muted border border-jarvis-border hover:bg-white/10"}`}
          >
            {workout ? "Yes" : "No"}
          </button>
        </div>
      </div>

      {/* Trading notes */}
      <div className="mb-4">
        <div className="text-xs text-jarvis-muted mb-1">Trading notes</div>
        <textarea
          value={tradingNotes}
          onChange={(e) => setTradingNotes(e.target.value)}
          placeholder="What worked? What didn't?"
          rows={2}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan/50 resize-none"
        />
      </div>

      {/* Wins */}
      <div className="mb-4">
        <div className="text-xs text-jarvis-muted mb-1">Today's wins</div>
        <textarea
          value={wins}
          onChange={(e) => setWins(e.target.value)}
          placeholder="What went well?"
          rows={2}
          className="w-full px-3 py-2 rounded-xl bg-white/5 border border-jarvis-border text-sm text-jarvis-ink placeholder-jarvis-muted focus:outline-none focus:border-jarvis-cyan/50 resize-none"
        />
      </div>

      <button
        onClick={submit}
        disabled={saving}
        className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-jarvis-purple/15 text-jarvis-purple hover:bg-jarvis-purple/25 transition flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        Save day
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Add slideUp animation to Tailwind config**

```js
// In tailwind.config.js → theme.extend.animation
slideUp: "slideUp 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
// In theme.extend.keyframes
slideUp: { from: { opacity: "0", transform: "translateY(24px)" }, to: { opacity: "1", transform: "translateY(0)" } },
```

- [ ] **Step 3: Commit**

```bash
git add src/components/today/EndOfDayReview.jsx tailwind.config.js
git commit -m "feat: add EndOfDayReview component — daily compound learning engine"
```

---

### Task 10: Wire Everything into Today.jsx

**Files:**
- Modify: `src/views/Today.jsx` (full rewrite)

- [ ] **Step 1: Rewrite Today.jsx as the orchestrator**

```jsx
// src/views/Today.jsx
import { useMemo } from "react";
import { useToday } from "../hooks/useJarvis.js";
import { useTodaySupa } from "../hooks/useTodaySupa.js";
import { useJarvisBrief, useCostToday } from "../hooks/useJarvis.js";
import { MorningBriefHero } from "../components/today/MorningBriefHero.jsx";
import { TopFiveFocus } from "../components/today/TopFiveFocus.jsx";
import { NextBestActions } from "../components/today/NextBestActions.jsx";
import { TimeBlocks } from "../components/today/TimeBlocks.jsx";
import { WaitingOn } from "../components/today/WaitingOn.jsx";
import { WasteDetector } from "../components/today/WasteDetector.jsx";
import { EndOfDayReview } from "../components/today/EndOfDayReview.jsx";
import { supabase } from "../lib/supabase.js";

export default function Today() {
  const { items, loading: calLoading, refresh: calRefresh } = useToday();
  const { brief, regenerateBrief, loading: briefLoading } = useJarvisBrief();
  const { cost } = useCostToday();
  const supa = useTodaySupa();

  const meetingCount = (items ?? []).filter((i) => i.kind !== "focus").length;
  const pipelineValue = supa.deals.reduce((s, d) => s + (d.value_usd ?? 0), 0);
  const tradingPnl = supa.positions.reduce((s, p) => s + (p.pnl_usd ?? 0), 0) + (supa.tradeJournal?.pnl_usd ?? 0);
  const followUpsDue = supa.followUps.filter((f) => f.status === "pending" && f.due_date <= new Date().toISOString().slice(0, 10)).length;
  const budgetRemaining = cost ? (cost.budgetUsd ?? 20) - (cost.spentUsd ?? 0) : null;

  // Calendar gaps: count hours between events where gap > 60min
  const calendarGaps = useMemo(() => {
    if (!items || items.length < 2) return items?.length === 0 ? 8 : 0;
    let gaps = 0;
    const sorted = [...items].sort((a, b) => new Date(a.start) - new Date(b.start));
    for (let i = 0; i < sorted.length - 1; i++) {
      const gapMs = new Date(sorted[i + 1].start) - new Date(sorted[i].end);
      if (gapMs >= 3600000) gaps += Math.floor(gapMs / 3600000);
    }
    return gaps;
  }, [items]);

  const showEod = new Date().getHours() >= 17;

  const handleFollowUpDone = async (dealId) => {
    if (!supabase) return;
    await supabase.from("deals").update({ last_touch: new Date().toISOString() }).eq("id", dealId);
    supa.refresh();
  };

  return (
    <div className="h-full w-full overflow-y-auto">
      <div className="space-y-6 p-6 max-w-6xl mx-auto">
        <MorningBriefHero
          brief={brief}
          meetingCount={meetingCount}
          pipelineValue={pipelineValue}
          tradingPnl={tradingPnl}
          followUpsDue={followUpsDue}
          budgetRemaining={budgetRemaining}
          onRegenerate={regenerateBrief}
          regenerating={briefLoading}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopFiveFocus deals={supa.deals} positions={supa.positions} followUps={supa.followUps} />
          <NextBestActions
            deals={supa.deals}
            positions={supa.positions}
            habits={supa.habits}
            calendarGaps={calendarGaps}
            onFollowUpDone={handleFollowUpDone}
          />
        </div>

        <TimeBlocks items={items} onRefresh={calRefresh} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <WaitingOn followUps={supa.followUps} onRefresh={supa.refresh} />
          <WasteDetector
            deals={supa.deals}
            positions={supa.positions}
            expenses={supa.expenses}
            habits={supa.habits}
            calendarItems={items}
          />
        </div>

        {showEod && <EndOfDayReview tradeJournal={supa.tradeJournal} onSaved={supa.refresh} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify the page loads**

Run: `npm run dev` — navigate to Today. Expected: all 7 modules render. Supabase modules show intelligent empty states. Calendar/brief modules show real data if jarvisd is running.

- [ ] **Step 3: Commit**

```bash
git add src/views/Today.jsx
git commit -m "feat: wire Today cockpit — 7 modules with Supabase + jarvisd data"
```

---

### Task 11: Tailwind Animations + Final Polish

**Files:**
- Modify: `tailwind.config.js`

- [ ] **Step 1: Ensure all animations are registered**

Read `tailwind.config.js` and verify these exist in `theme.extend`:

```js
animation: {
  fadeIn: "fadeIn 200ms ease-out",
  slideUp: "slideUp 400ms cubic-bezier(0.34, 1.56, 0.64, 1)",
},
keyframes: {
  fadeIn: {
    from: { opacity: "0", transform: "translateY(4px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },
  slideUp: {
    from: { opacity: "0", transform: "translateY(24px)" },
    to: { opacity: "1", transform: "translateY(0)" },
  },
},
```

- [ ] **Step 2: Verify full page with dev server**

Run: `npm run dev` — open Today page. Check:
- Hero renders with date + stat chips
- TopFiveFocus shows empty state
- NextBestActions shows empty state
- TimeBlocks shows calendar events (if jarvisd running)
- WaitingOn shows "Nothing pending"
- WasteDetector shows green "No waste" or real alerts
- EndOfDayReview appears after 5pm

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Today cockpit — M2 Batch 2 page 1 of 6"
```
