# M2 Batch 2 — Money Command Center Design

> Part of M2 Batch 2: Remaining Surfaces
> Page 2 of 6 in rollout order: Today → **Money** → Work → Health → Home Life → Brain
> Date: 2026-04-12

## Goal

Build a financial war room that answers one question in under 10 seconds: "Am I getting richer or poorer right now, and why?" Covers three money engines (Sales revenue, Trading P&L, Operating costs) in a single view with proactive leak detection and capital deployment recommendations.

## Architecture

Same pattern as Today: precomputed server-side intelligence in a `money_intelligence` table, Realtime push to the frontend, zero client-side computation. Extends the existing `today-compute` Edge Function to also compute money metrics.

```
Source tables (deals, positions, expenses, trade_journal, daily_snapshot)
    ↓  Existing DB triggers on deals/positions + cron
    ↓
Edge Function: today-compute (extended)
    ↓  computes money_intelligence alongside today_intelligence
    ↓
money_intelligence table (1 row per user per day, JSONB)
    ↓  Supabase Realtime
    ↓
Frontend: useMoneySupa reads 1 row, 0 computation
```

## New Table: `money_intelligence`

```sql
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
```

### JSONB Column Shapes

**velocity:**
```json
{
  "daily_net": 1247,
  "vs_last_week_pct": 12.3,
  "sales_contribution": 850,
  "trading_contribution": 847,
  "cost_drag": -450,
  "sparkline_7d": [980, 1100, -200, 1500, 1247, 890, 1247]
}
```

**engines:**
```json
{
  "sales": {
    "pipeline_value": 85000,
    "deals_closing_soon": 3,
    "weighted_value": 42500,
    "status": "3 deals closing this week"
  },
  "trading": {
    "open_pnl": 2410,
    "today_pnl": 847,
    "win_rate_today": 0.75,
    "open_positions": 4,
    "status": "+$847 today, 75% win rate"
  },
  "ops": {
    "monthly_burn": 640,
    "active_subscriptions": 12,
    "vs_last_month": -45,
    "status": "12 active subs, $640/mo"
  }
}
```

**leaks:**
```json
[
  { "id": "unused-sub-1", "type": "unused_subscription", "text": "$49/mo Zapier — no usage in 30d", "amount": 49, "severity": "high" },
  { "id": "low-margin-1", "type": "low_margin_deal", "text": "Deal X below 15% margin floor", "amount": 0, "severity": "medium" },
  { "id": "no-stoploss", "type": "unprotected_position", "text": "3 positions with no stop-loss, $4k exposed", "amount": 4000, "severity": "high" },
  { "id": "ai-overspend", "type": "ai_overspend", "text": "AI spend 40% over daily pace", "amount": 8, "severity": "medium" }
]
```

**deploy:**
```json
[
  { "id": "close-acme", "type": "close_deal", "text": "Close Acme = +$12k revenue", "impact": 12000, "icon": "DollarSign" },
  { "id": "cut-zapier", "type": "cut_expense", "text": "Cut Zapier = save $49/mo ($588/yr)", "impact": 588, "icon": "Scissors" },
  { "id": "set-stops", "type": "reduce_risk", "text": "Set stop-losses = reduce $4k open risk", "impact": 4000, "icon": "Shield" }
]
```

**scorecard:**
```json
{
  "today": { "wins": 3, "losses": 1, "pnl": 847 },
  "week": { "wins": 12, "losses": 5, "pnl": 2410 },
  "best_trade": { "ticker": "SMCI", "pnl": 1200 },
  "worst_trade": { "ticker": "AAPL", "pnl": -340 },
  "avg_hold_hours": 2.3
}
```

**expense_radar:**
```json
[
  { "category": "Subscriptions", "amount": 340, "count": 8 },
  { "category": "AI/Tools", "amount": 180, "count": 3 },
  { "category": "Services", "amount": 120, "count": 2 }
]
```

## Page Modules

### 1. CapitalVelocityHero
- Full-width glass panel with cyan glow (positive) or red glow (negative)
- Large number: daily net money flow (`velocity.daily_net`)
- Subtitle: "You're making $X/day this week" or "You're losing $X/day this week"
- Change chip: vs last week percentage
- Three inline contribution chips: Sales +$X, Trading +$X, Costs -$X
- 7-day sparkline (simple SVG polyline from `velocity.sparkline_7d`)
- Motion: number counts up from 0 (300ms), sparkline draws left-to-right (400ms)

### 2. ThreeEngines
- Left column, glass panel
- Header: `label` "THREE ENGINES"
- Three stacked cards, each showing:
  - Engine icon + name + color (Sales blue, Trading purple, Ops cyan)
  - Key number (pipeline value / open P&L / monthly burn)
  - One-line status text
  - Small trend indicator (up/down arrow)
- Click engine → navigates to relevant page (Work for Sales, Trading section for Trading, Expense detail for Ops)
- Motion: stagger in 100ms each

### 3. MoneyLeaks
- Right column, glass panel
- Header: `label` "MONEY LEAKS"
- Each leak: warning icon + text + monthly amount in red
- Bottom total: "Total leak: $X/mo" in red
- Severity drives icon color (high = red, medium = amber)
- Green empty state: shield + "No leaks detected — clean finances"
- Motion: pulse once on appear

### 4. DeployCapital
- Left column, glass panel
- Header: `label` "DEPLOY CAPITAL"
- Stark-style recommendation cards ranked by dollar impact
- Each card: icon + action text + impact amount in green
- One-tap action button (Done/Dismiss)
- Max 4 recommendations
- Empty state: "Recommendations appear as you add deals and expenses"

### 5. TradingScorecard
- Right column, glass panel
- Header: `label` "TRADING SCORECARD"
- Two-row summary: Today (W/L/P&L) and This Week (W/L/P&L)
- Best/Worst trade pills with ticker + P&L
- Avg hold time stat
- Win rate as a small colored bar (green portion = wins)
- Empty state: "Log your first trade to see your scorecard"

### 6. ExpenseRadar
- Full-width glass panel
- Header: `label` "MONTHLY BURN"
- Horizontal bar chart (SVG, no dependencies) grouped by category
- Each bar: category name, bar, amount, count
- Bottom total with vs-last-month comparison
- Motion: bars animate width from 0 (300ms, staggered 50ms each)

## Component File Structure

```
src/views/Money.jsx                    ← orchestrator (rewrite)
src/components/money/
  CapitalVelocityHero.jsx
  ThreeEngines.jsx
  MoneyLeaks.jsx
  DeployCapital.jsx
  TradingScorecard.jsx
  ExpenseRadar.jsx
src/hooks/
  useMoneySupa.js                      ← reads money_intelligence + Realtime
```

## Layout

```
<div class="space-y-6 p-6 max-w-6xl mx-auto">
  <CapitalVelocityHero />

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <ThreeEngines />
    <MoneyLeaks />
  </div>

  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <DeployCapital />
    <TradingScorecard />
  </div>

  <ExpenseRadar />
</div>
```

## Visual Treatment

### Typography & spacing
- Hero velocity number: `font-display text-4xl text-jarvis-ink` (or `text-jarvis-green`/`text-jarvis-red`)
- Module headers: `label` class
- Content: `text-sm text-jarvis-body`
- Money amounts: `tabular-nums font-semibold`
- Module spacing: `gap-6`
- Internal padding: `p-5`

### Color mapping
- Positive flow: `jarvis-green`
- Negative/loss: `jarvis-red`
- Warning/leak: `jarvis-amber`
- Sales: `jarvis-blue`
- Trading: `jarvis-purple`
- Ops/costs: `jarvis-cyan`

### Empty states
Every module shows an intelligent empty state explaining what data to add and where. No fake data.

### Motion
- Hero number: count up from 0 (300ms)
- Hero sparkline: polyline draws left-to-right via stroke-dashoffset animation (400ms)
- Engine cards: stagger in 100ms
- Leak alerts: pulse once
- Expense bars: width animates from 0 (300ms, staggered 50ms)
- Velocity hero border: green glow if positive, red glow if negative

## Edge Function Extension

Extend `today-compute` to also compute and upsert `money_intelligence`:

**Additional computation pipeline (after today_intelligence upsert):**

1. **Velocity**: query `daily_snapshot` for last 7 days. Compute daily net from `pipeline_value` delta + `trading_pnl` - `ai_spend_usd`. Build sparkline array. Compare to prior week.
2. **Engines**: aggregate `deals` (pipeline), `positions` (open P&L + today P&L from trade_journal), `expenses` (monthly sum by active).
3. **Leaks**: expenses with no usage flag or amount > threshold, deals below margin floor (value_usd < configurable threshold), positions without stop_loss, AI spend exceeding budget pace.
4. **Deploy**: rank actionable items by dollar impact — closeable deals, cuttable expenses, risk reduction from stop-losses.
5. **Scorecard**: aggregate `trade_journal` today + this week. Find best/worst from `positions` closed this week.
6. **Expense Radar**: group `expenses` by category, sum amounts, count items.

Upsert into `money_intelligence` with same `(user_id, date)` conflict resolution.

## DB Trigger Integration

No new triggers needed. The existing triggers on `deals`, `positions`, `follow_ups` already call `today-compute`. The extended function now also computes money metrics. Changes to `expenses` are low-frequency (monthly) — covered by the 15-minute cron.

To also trigger on expense changes, add one new trigger:

```sql
create trigger expenses_today_compute
  after insert or update or delete on expenses
  for each row execute function notify_today_compute();
```

## Backend Wiring Summary

| Data | Source | Status |
|---|---|---|
| Deals pipeline | Supabase `deals` | Exists (Today cockpit) |
| Positions P&L | Supabase `positions` | Exists |
| Trade journal | Supabase `trade_journal` | Exists |
| Expenses | Supabase `expenses` | Exists |
| Daily snapshots | Supabase `daily_snapshot` | Exists |
| Money intelligence | Supabase `money_intelligence` | New table |
| Edge Function | `today-compute` (extended) | Modify |
| Expense trigger | New trigger on `expenses` | New |

## Env Vars
No new env vars. Uses same Supabase secrets as today-compute.

## Deferred Items
- Real-time stock price feeds (positions show manual current_price)
- Commission tracking per deal (needs commission_rate field on deals)
- Tax estimation module
- P&L by time-of-day heatmap (needs trade timestamps, not just daily journal)
