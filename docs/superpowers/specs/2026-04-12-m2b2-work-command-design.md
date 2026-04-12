# M2 Batch 2 — Work Sales Command Center Design

> Part of M2 Batch 2: Remaining Surfaces
> Page 3 of 6 in rollout order: Today → Money → **Work** → Health → Home Life → Brain
> Date: 2026-04-12

## Goal

Build a sales operations center that shows every deal, every follow-up, every contact — and tells you which call to make right now. The only metric that matters is revenue velocity: how fast deals move through the pipeline.

## Architecture

Same precomputed intelligence pattern. New `work_intelligence` table with JSONB columns. `today-compute` Edge Function extended. Realtime push. Zero client-side computation.

## New Table: `work_intelligence`

```sql
create table if not exists work_intelligence (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date            date not null default current_date,
  pipeline_stats  jsonb not null default '{}',
  deal_board      jsonb not null default '{}',
  follow_up_queue jsonb not null default '[]',
  contacts_summary jsonb not null default '[]',
  deal_velocity   jsonb not null default '{}',
  computed_at     timestamptz not null default now(),
  unique(user_id, date)
);

alter table work_intelligence enable row level security;
create policy "work_intelligence_owner" on work_intelligence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_work_intelligence_user_date
  on work_intelligence(user_id, date);

alter publication supabase_realtime add table work_intelligence;

-- Trigger on contacts changes
create trigger contacts_today_compute
  after insert or update or delete on contacts
  for each row execute function notify_today_compute();
```

### JSONB Column Shapes

**pipeline_stats:**
```json
{
  "total_value": 245000,
  "active_deals": 12,
  "closing_this_week": 3,
  "conversion_rate": 34,
  "avg_cycle_days": 18,
  "velocity_vs_last_month_pct": 12,
  "funnel": [
    { "stage": "prospect", "count": 5, "value": 65000 },
    { "stage": "quoted", "count": 4, "value": 95000 },
    { "stage": "negotiating", "count": 2, "value": 55000 },
    { "stage": "closed_won", "count": 1, "value": 30000 }
  ]
}
```

**deal_board:**
```json
{
  "prospect": [
    { "id": "uuid", "company": "Acme", "value": 85000, "contact": "Alex Rivera", "days_in_stage": 3, "last_touch_days": 2, "probability": 60 }
  ],
  "quoted": [],
  "negotiating": [],
  "closed_won": []
}
```

**follow_up_queue:**
```json
[
  { "id": "uuid", "action": "Call Acme re: quote", "contact": "Alex Rivera", "company": "Acme", "deal_id": "uuid", "due_date": "2026-04-12", "days_overdue": 1, "priority": "high", "status": "pending" }
]
```

**contacts_summary:**
```json
[
  { "id": "uuid", "name": "Alex Rivera", "company": "Acme", "role": "VP Ops", "last_interaction_days": 2, "deal_value": 85000, "going_cold": false }
]
```

**deal_velocity:**
```json
{
  "avg_days": {
    "prospect_to_quoted": 4,
    "quoted_to_negotiating": 8,
    "negotiating_to_closed": 6,
    "total_cycle": 18
  },
  "vs_last_30d_days": -2,
  "bottleneck_stage": "quoted",
  "deals_closed_30d": 4,
  "win_rate_30d": 34
}
```

## Page Modules

### 1. PipelineHero
- Full-width glass panel
- Large pipeline value: `font-display text-3xl text-jarvis-blue`
- 4 stat chips: active deals, closing this week, conversion %, avg cycle days
- Velocity trend chip: ↑12% or ↓5% vs last month
- Mini funnel: 4 horizontal segments proportional to deal count per stage
- Each segment shows stage name + count + value
- Colors: prospect=muted, quoted=cyan, negotiating=amber, closed=green
- Empty state: "Add your first deal to see pipeline stats"
- Motion: fade in, funnel segments animate width from 0

### 2. DealBoard
- Left column (wide), glass panel
- Header: `label` "DEAL BOARD"
- Horizontal kanban with 4 columns: Prospect, Quoted, Negotiating, Closed Won
- Each column: header with stage name + count, then stacked deal cards
- Deal card: company name, value chip, contact name, days-in-stage badge
- Cards with `last_touch_days >= 3`: amber left border
- Cards with `last_touch_days >= 7`: red left border
- Click card → expand to show notes, probability, close date, quick actions (Move stage, Add follow-up)
- Columns scroll independently if overflow
- Empty state per column: dashed outline "No deals"
- Motion: cards stagger in per column

### 3. FollowUpQueue
- Right column, glass panel
- Header: `label` "FOLLOW-UP QUEUE"
- Subtitle: "Overdue: X · Today: X · This week: X" counts
- Ordered: overdue first (red), due today (amber), future (green)
- Each row: priority icon, action text, contact name, company, age chip
- Quick actions: Done (checkmark), Snooze (+1d), Skip
- Done action: marks follow_up complete + updates deal.last_touch via Supabase
- Max 10 visible, scroll for more
- Empty state: "No follow-ups — add one from the quick bar"
- Motion: stagger in

### 4. ContactsPanel
- Left column (lower), glass panel
- Header: `label` "KEY CONTACTS"
- Top contacts sorted by deal value descending
- Each row: name, company, role chip, last interaction days, linked deal value
- Going cold (5+ days): amber warning badge
- Cold (10+ days): red badge
- Quick-add inline form at bottom: name, company, role
- Max 8 visible
- Empty state: "Add contacts to track your key relationships"

### 5. DealVelocity
- Right column (lower), glass panel
- Header: `label` "DEAL VELOCITY"
- 3 stage-to-stage rows with avg days + horizontal bar
- Total cycle days with trend (↓2d = good, ↑ = bad)
- Bottleneck indicator: which stage is slowest (highlighted in red)
- Win rate badge: 34% over last 30 days
- Deals closed count: last 30 days
- Empty state: "Close your first deal to see velocity metrics"

### 6. QuickAddBar
- Full-width sticky bottom bar, glass panel
- Three buttons: [+ Deal] [+ Follow-up] [+ Contact]
- Click opens an inline expandable form (no modal, no navigation)
- Deal form: company, value, stage (dropdown), contact name, close date, notes
- Follow-up form: action, deal (dropdown from existing deals), contact, due date, priority
- Contact form: name, company, role, email, phone
- All forms write directly to Supabase
- On submit: form collapses, data appears in board/queue via Realtime
- Motion: form slides down from button, 200ms

## Component File Structure

```
src/views/Work.jsx                     ← orchestrator (rewrite)
src/components/work/
  PipelineHero.jsx
  DealBoard.jsx
  FollowUpQueue.jsx
  ContactsPanel.jsx
  DealVelocity.jsx
  QuickAddBar.jsx
src/hooks/
  useWorkSupa.js                       ← reads work_intelligence + Realtime
```

## Layout

```
<div class="flex flex-col h-full">
  <div class="flex-1 overflow-y-auto">
    <div class="space-y-6 p-6 max-w-7xl mx-auto">
      <PipelineHero />

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div class="lg:col-span-2"><DealBoard /></div>
        <FollowUpQueue />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ContactsPanel />
        <DealVelocity />
      </div>
    </div>
  </div>

  <QuickAddBar />
</div>
```

Note: max-w is 7xl (wider than Today/Money) because the deal board needs horizontal space for 4 kanban columns.

## Visual Treatment

### Colors
- Prospect stage: `text-jarvis-muted`
- Quoted stage: `text-jarvis-cyan`
- Negotiating stage: `text-jarvis-amber`
- Closed Won stage: `text-jarvis-green`
- Closed Lost: `text-jarvis-red`
- Cold contact: `text-jarvis-amber` → `text-jarvis-red`
- Overdue follow-up: `text-jarvis-red`
- Due today: `text-jarvis-amber`
- Future: `text-jarvis-green`

### Typography
- Pipeline value: `font-display text-3xl text-jarvis-blue`
- Deal card company: `text-sm text-jarvis-ink font-semibold`
- Deal card value: `text-xs tabular-nums`
- Stage headers: `label`
- Follow-up action text: `text-sm text-jarvis-ink`

### Motion
- Hero funnel bars: animate width from 0 (300ms, staggered)
- Deal cards: stagger in per column (50ms per card)
- Follow-up queue: stagger in (100ms)
- Done action: card slides out right + collapses (300ms)
- QuickAdd form: slides down (200ms ease-out)

## Edge Function Extension

Extend `today-compute` to compute `work_intelligence`:

1. **Pipeline stats**: count deals by stage, sum values, compute conversion rate (closed_won / total started last 30d), avg cycle (avg days from created_at to closed_at for closed_won deals)
2. **Deal board**: group deals by stage, include contact name from contacts join, compute days_in_stage from updated_at, compute last_touch_days
3. **Follow-up queue**: order by overdue first (due_date < today), then due today, then future. Include contact/deal names from joins. Compute days_overdue.
4. **Contacts summary**: contacts with linked deals, sorted by deal value. Compute last_interaction_days, flag going_cold (5+ days)
5. **Deal velocity**: for closed_won deals last 90d, compute avg days between stage transitions. Identify bottleneck (slowest stage). Compare to prior 30d window.

Upsert into `work_intelligence` with same `(user_id, date)` conflict resolution.

## DB Trigger Integration

Existing triggers on `deals` and `follow_ups` already fire `notify_today_compute`. New trigger on `contacts` added in migration. All three tables automatically recompute work intelligence on change.

## Backend Wiring Summary

| Data | Source | Status |
|---|---|---|
| Deals | Supabase `deals` | Exists |
| Contacts | Supabase `contacts` | Exists |
| Follow-ups | Supabase `follow_ups` | Exists |
| Work intelligence | Supabase `work_intelligence` | New table |
| Edge Function | `today-compute` (extended) | Modify |
| Contact trigger | New trigger on `contacts` | New |

## Deferred Items
- Drag-and-drop deal cards between columns (needs DnD library)
- Pipedrive bi-directional sync (external-sync skeleton ready)
- Deal stage history tracking (needs stage_transitions table)
- Email integration (compose follow-up email from deal card)
- Team delegation (needs user/team model)
