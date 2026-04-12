# Work Sales Command Center — Implementation Plan
Date: 2026-04-12
Branch: codex/jarvis-phase-3

## Goal
Build the Work Sales Command Center for JARVIS OS. Precomputed intelligence pattern identical to Money Command Center. Zero client-side computation.

## Source Pattern
- Hook: `src/hooks/useMoneySupa.js` → copy to `useWorkSupa.js`
- Orchestrator: `src/views/Money.jsx` → replace `src/views/Work.jsx`
- Migration: `supabase/migrations/20260412_money_intelligence.sql`
- Edge Function: `supabase/functions/today-compute/index.ts` (extend)

## Tasks (in order)

### Step 1 — Migration: `supabase/migrations/20260412_work_intelligence.sql`
- `work_intelligence` table: id, user_id, date, pipeline_stats jsonb, deal_board jsonb, follow_up_queue jsonb, contacts_summary jsonb, deal_velocity jsonb, computed_at
- RLS + owner policy
- Index on (user_id, date)
- Realtime publication
- Trigger on contacts → notify_today_compute()
- Apply: `supabase db query --linked -f supabase/migrations/20260412_work_intelligence.sql`

### Step 2 — Edge Function: extend `today-compute/index.ts`
Add work intelligence computation block AFTER money_intelligence upsert, BEFORE return:
- Fetch all deals (all stages), follow_ups, contacts for userId
- `pipeline_stats`: count/sum by stage, closed_won last 30d conversion rate, avg cycle days, velocity vs last month, funnel array
- `deal_board`: group deals by stage (prospect/quoted/negotiating/closed_won), join contacts, compute days_in_stage and last_touch_days
- `follow_up_queue`: pending/waiting ordered overdue→today→future, days_overdue computed
- `contacts_summary`: contacts with linked deals, last_interaction_days, going_cold flag (5+ days)
- `deal_velocity`: closed_won last 90d avg cycle, bottleneck stage, win_rate 30d
- Upsert into `work_intelligence` with onConflict `user_id,date`
- Deploy: `supabase functions deploy today-compute --no-verify-jwt`

### Step 3 — Hook: `src/hooks/useWorkSupa.js`
Exact copy of useMoneySupa.js pattern:
- Table: `work_intelligence`
- Channel: `work-intel`
- Returns `intelligence`, `loading`, `error`, `refresh`, `recompute`

### Step 4 — Components: `src/components/work/`
Six components:
1. `PipelineHero.jsx` — full-width glass, pipeline value font-display text-3xl text-jarvis-blue, 4 stat chips, velocity chip, mini funnel bars
2. `DealBoard.jsx` — 4 kanban columns, deal cards with amber/red border by last_touch_days, expand on click
3. `FollowUpQueue.jsx` — ordered list overdue/today/future, Done/Snooze quick actions writing to Supabase
4. `ContactsPanel.jsx` — sorted by deal value, going_cold badges, quick-add inline form
5. `DealVelocity.jsx` — stage transition bars, bottleneck red, win rate badge
6. `QuickAddBar.jsx` — sticky bottom, +Deal/+Follow-up/+Contact inline forms writing to Supabase

### Step 5 — Orchestrator: `src/views/Work.jsx`
Rewrite with:
- `useWorkSupa` hook
- Layout: hero full-width, 3-col grid (DealBoard 2-col + FollowUpQueue 1-col), 2-col grid (ContactsPanel + DealVelocity), QuickAddBar sticky bottom
- max-w-7xl container

### Step 6 — Verify
`npx vite build` — must complete with no errors

## Visual Tokens
- Pipeline value: `font-display text-3xl text-jarvis-blue`
- Prospect: `text-jarvis-muted` | Quoted: `text-jarvis-cyan` | Negotiating: `text-jarvis-amber` | Closed Won: `text-jarvis-green`
- Cold contact: amber → red | Overdue: red | Due today: amber | Future: green
- Glass panels: `glass p-6`
- Labels: `label` class
- Chips: `chip` class

## Commit Checkpoints
1. After migration applied
2. After edge function deployed
3. After hook + components
4. After Work.jsx rewrite + build passes
