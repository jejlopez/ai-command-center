# M2 Batch 2 — Today Cockpit Design

> Part of M2 Batch 2: Remaining Surfaces
> Page 1 of 6 in rollout order: Today → Money → Work → Health → Home Life → Brain
> Date: 2026-04-12

## Goal

Turn the Today page into a 60-second daily cockpit that serves three roles: VP of Sales (3PL/shipping), small-cap day trader, and vibe coder. Every module must either save time, save money, reduce waste, or help JARVIS learn from behavior.

## Architecture

Supabase is the shared data backbone (structured data, shared across apps). jarvisd is the local intelligence layer (calendar, LLM, skills, vault). Frontend reads both.

```
Frontend (React)
  ├── Supabase client → deals, positions, follow_ups, daily_snapshot, health_log, habits, expenses
  └── jarvisd client  → /brief, /today, /focus-blocks, /cost/today, /memory
```

## Supabase Tables (new migrations)

### deals
```sql
create table deals (
  id            uuid default gen_random_uuid() primary key,
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company       text not null,
  contact_name  text,
  contact_id    uuid references contacts(id),
  stage         text not null default 'prospect',  -- prospect, quoted, negotiating, closed_won, closed_lost
  value_usd     real not null default 0,
  probability   int not null default 50,           -- 0-100
  close_date    date,
  last_touch    timestamptz default now(),
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

### contacts
```sql
create table contacts (
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
```

### follow_ups
```sql
create table follow_ups (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete set null,
  action      text not null,               -- "Call back re: quote", "Send proposal"
  due_date    date not null,
  status      text not null default 'pending',  -- pending, waiting, done, snoozed
  priority    text not null default 'normal',   -- low, normal, high, urgent
  completed_at timestamptz,
  notes       text,
  created_at  timestamptz default now()
);
```

### positions
```sql
create table positions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker      text not null,
  side        text not null default 'long',  -- long, short
  entry_price real not null,
  size        real not null,                 -- shares or contracts
  current_price real,
  stop_loss   real,
  target      real,
  status      text not null default 'open',  -- open, closed
  pnl_usd     real not null default 0,
  opened_at   timestamptz default now(),
  closed_at   timestamptz,
  notes       text
);
```

### watchlist
```sql
create table watchlist (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  ticker      text not null,
  alert_price real,
  direction   text,  -- 'above', 'below'
  notes       text,
  added_at    timestamptz default now()
);
```

### trade_journal
```sql
create table trade_journal (
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
```

### daily_snapshot
```sql
create table daily_snapshot (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date            date not null default current_date,
  -- Sales
  open_deals      int not null default 0,
  pipeline_value  real not null default 0,
  deals_touched   int not null default 0,
  -- Trading
  trading_pnl     real not null default 0,
  trades_taken    int not null default 0,
  -- Productivity
  meetings_count  int not null default 0,
  tasks_completed int not null default 0,
  focus_hours     real not null default 0,
  -- Wellbeing
  energy_score    int,  -- 1-10
  sleep_hours     real,
  -- Cost
  ai_spend_usd    real not null default 0,
  notes           text,
  created_at      timestamptz default now(),
  unique(user_id, date)
);
```

### expenses
```sql
create table expenses (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  amount_usd  real not null,
  category    text not null default 'other',  -- subscription, tool, service, office, other
  frequency   text not null default 'monthly', -- once, weekly, monthly, annual
  next_due    date,
  active      boolean not null default true,
  notes       text,
  created_at  timestamptz default now()
);
```

### health_log
```sql
create table health_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  sleep_hours real,
  energy      int,  -- 1-10
  workout     boolean default false,
  workout_type text,
  notes       text,
  created_at  timestamptz default now(),
  unique(user_id, date)
);
```

### habits
```sql
create table habits (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name            text not null,
  frequency       text not null default 'daily',  -- daily, weekdays, weekly
  current_streak  int not null default 0,
  best_streak     int not null default 0,
  last_done       date,
  active          boolean not null default true,
  created_at      timestamptz default now()
);
```

### jarvis_suggestions
```sql
create table jarvis_suggestions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  type        text not null,     -- follow_up, trade_alert, waste, habit, health
  suggestion  text not null,
  context     jsonb,
  acted_on    boolean,
  outcome     text,              -- positive, negative, ignored
  created_at  timestamptz default now()
);
```

All tables get RLS: `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

## Supabase Client Setup

New file: `src/lib/supabase.js`
```js
import { createClient } from '@supabase/supabase-js';
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(url, key);
```

## Today Page Modules

### 1. MorningBriefHero
- Full-width top card, `glass` panel with subtle cyan glow border
- Date in `font-display text-3xl text-jarvis-ink`
- 5 stat chips inline (`chip` class):
  - Meetings today (jarvisd `/today` → count events)
  - Pipeline value (Supabase `deals` → sum value_usd where stage not closed)
  - Trading P&L (Supabase `positions` → sum pnl_usd where status=open, plus `trade_journal` today)
  - Follow-ups due (Supabase `follow_ups` → count where due_date ≤ today and status=pending)
  - Budget remaining (jarvisd `/cost/today`)
- AI narrative line from jarvisd `/brief`
- Regenerate button (existing)
- Motion: fade in 200ms on mount

### 2. TopFiveFocus
- Left column, glass panel
- Header: `label` class "TODAY'S FOCUS"
- Sources ranked by dollar impact:
  - Supabase `deals` with highest value × probability where stage is active
  - Supabase `positions` with largest unrealized P&L
  - Supabase `follow_ups` marked priority=urgent or high
- Each row: rank number (1-5), label, value chip, role badge (Sales `jarvis-blue` / Trading `jarvis-purple` / Code `jarvis-cyan`)
- Click → expand to show notes + quick actions (mark done, snooze, open deal)
- Empty state: "Add your first deal or position to see priorities here." + link to Work and Money pages
- Motion: stagger in 100ms per item after hero

### 3. NextBestActions
- Right column, glass panel
- Header: `label` class "NEXT BEST MOVE"
- Computed signals:
  - Supabase `deals` where last_touch < now() - interval '3 days' → "Follow up with [company]"
  - Supabase `positions` where current_price crosses alert thresholds → "Check [TICKER]"
  - jarvisd `/today` calendar gaps > 60min → "Block for deep work"
  - Supabase `habits` where last_done < today → "Log [habit name]"
- Max 4 cards
- Each card: icon (Phone/TrendingUp/Clock/Heart) + text + action button (Done/Snooze/Open)
- Amber glow on items overdue 48h+
- Empty state: "Actions will appear as you add deals, positions, and habits."
- Motion: stagger in 100ms after TopFiveFocus

### 4. TimeBlocks
- Full-width, glass panel
- Horizontal timeline from 6am–10pm
- Apple Calendar events as solid blocks (color by calendar source)
- Focus blocks overlaid in cyan
- Current time: vertical cyan line, opacity pulses 0.7↔1.0 (2s cycle)
- Conflicts: red border + glow pulse (3s cycle)
- Open slots: dashed outline, clickable → inline focus block form
- Data: jarvisd `/today` + `/focus-blocks`
- Motion: slide in from left, 300ms

### 5. WaitingOn
- Left column, glass panel
- Header: `label` class "WAITING ON"
- Source: Supabase `follow_ups` where status='waiting'
- Each row: contact name, deal company, days waiting, last touch date
- Color: 1-3 days `text-jarvis-green`, 3-7 `text-jarvis-amber`, 7+ `text-jarvis-red`
- Quick action: "Nudge" button → creates new follow-up with due=tomorrow
- Empty state: "Nothing pending — nice."

### 6. WasteDetector
- Right column, glass panel
- Header: `label` class "WASTE DETECTOR"
- Computed alerts:
  - jarvisd calendar: meetings with empty description → "X min of meetings with no agenda"
  - Supabase deals: stage not closed, last_touch > 7 days → "X deals going stale"
  - Supabase expenses: due this week → "Expense: $X due for [name]"
  - Supabase positions: open with no stop_loss → "X positions with no stop-loss"
  - Supabase habits: broken streak → "[habit] streak broken after X days"
- Each alert: warning icon + text + suggested fix link
- Green empty state: shield icon + "No waste detected — clean day."
- Motion: alerts pulse once on appear

### 7. EndOfDayReview
- Full-width bottom panel, only visible after 5pm (configurable)
- Glass panel with jarvis-purple accent border
- Header: "End of Day Review"
- Fields:
  - Energy score: 1-10 button strip
  - Trading notes: textarea
  - Today's wins: textarea
  - Workout done: toggle
- Submit → upserts into `daily_snapshot` + `health_log` + `trade_journal` for today
- Motion: slides up from bottom, spring easing, 400ms

## Component File Structure

```
src/views/Today.jsx                    ← orchestrator (rewrite)
src/components/today/
  MorningBriefHero.jsx
  TopFiveFocus.jsx
  NextBestActions.jsx
  TimeBlocks.jsx                       ← refactor from current Today.jsx
  WaitingOn.jsx
  WasteDetector.jsx
  EndOfDayReview.jsx
src/hooks/
  useToday.js                          ← existing (calendar + focus blocks from jarvisd)
  useTodaySupa.js                      ← NEW: Supabase queries for deals, follow-ups, positions
src/lib/
  supabase.js                          ← NEW: Supabase client singleton
```

## Visual Treatment

### Typography & spacing
- Hero date: `font-display text-3xl text-jarvis-ink`
- Module headers: `label` class (uppercase, tracked)
- Content: `text-sm text-jarvis-body`
- Values/numbers: `text-jarvis-ink font-semibold`
- Module spacing: `gap-6` (24px)
- Internal padding: `p-5` (20px)
- List item spacing: `space-y-3` (12px)

### Color by role
- Sales: `jarvis-blue` (#60a5fa)
- Trading: `jarvis-purple`
- Code: `jarvis-cyan` (#5de8ff)
- Risk/overdue: `jarvis-red`
- Waiting: `jarvis-amber`
- Clear/done: `jarvis-green`

### Empty states
Every module shows an intelligent empty state that:
1. Explains what will appear
2. Links to where you add the data
3. Never shows fake/placeholder data

### Motion (Emil rules)
- Page load sequence: hero (200ms) → left column (300ms) → right column (400ms) → timeline (500ms)
- Current-time indicator: opacity pulse 0.7↔1.0, 2s ease-in-out infinite
- Conflict borders: red glow pulse, 3s ease-in-out infinite
- Action card completion: slide out right + collapse height, 300ms spring
- Stat chip numbers: count up from 0, 200ms
- End-of-day review: slide up from bottom, 400ms spring

## Layout

```
<div class="space-y-6 p-6 max-w-6xl mx-auto">
  <!-- Hero: full width -->
  <MorningBriefHero />

  <!-- Two-column grid -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <TopFiveFocus />
    <NextBestActions />
  </div>

  <!-- Timeline: full width -->
  <TimeBlocks />

  <!-- Two-column grid -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <WaitingOn />
    <WasteDetector />
  </div>

  <!-- End of day: full width, conditional -->
  {showEodReview && <EndOfDayReview />}
</div>
```

## Backend Wiring Summary

| Data | Source | Status |
|------|--------|--------|
| Calendar events | jarvisd `/today` | Existing |
| Focus blocks | jarvisd `/focus-blocks` | Existing |
| Morning brief | jarvisd `/brief` | Existing |
| Cost/budget | jarvisd `/cost/today` | Existing |
| Deals + pipeline | Supabase `deals` | New table |
| Contacts | Supabase `contacts` | New table |
| Follow-ups | Supabase `follow_ups` | New table |
| Positions + P&L | Supabase `positions` | New table |
| Trade journal | Supabase `trade_journal` | New table |
| Daily snapshot | Supabase `daily_snapshot` | New table |
| Expenses | Supabase `expenses` | New table |
| Health log | Supabase `health_log` | New table |
| Habits | Supabase `habits` | New table |
| Suggestions | Supabase `jarvis_suggestions` | New table |

## Deferred Items
- Real-time stock price feeds (needs a market data API; positions show manual current_price for now)
- Pipedrive sync (M4 scope — until then, deals table is the CRM)
- Push notifications for follow-up reminders
- Voice input for end-of-day review
