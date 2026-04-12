# Today Auto-Intelligence Layer Design

> Date: 2026-04-12
> Depends on: M2 Batch 2 Today Cockpit (committed)

## Goal

Make the Today Cockpit fully auto-updating: precomputed server-side intelligence, instant page loads, Realtime push, proactive alerts. Zero client-side computation. One table, one subscription, one read.

## Architecture

```
Source tables (deals, positions, follow_ups, habits, expenses, trade_journal)
    ↓  DB triggers on deals/follow_ups/positions
    ↓  pg_cron every 15min (6am-8pm), hourly overnight
    ↓
Edge Function: today-compute
    ↓  reads all source tables, computes derived metrics
    ↓
today_intelligence table (1 row per user per day, JSONB columns)
    ↓  Supabase Realtime
    ↓
Frontend: useTodaySupa reads 1 row, 0 computation
```

## New Table: `today_intelligence`

```sql
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
```

Enable Realtime replication on `today_intelligence` only.

### JSONB Column Shapes

**hero_stats:**
```json
{
  "meetings": 6,
  "pipeline_value": 245000,
  "trading_pnl": 1250,
  "follow_ups_due": 3,
  "budget_remaining": 12.40
}
```

**top_five:**
```json
[
  { "type": "deal", "id": "uuid", "label": "Acme — negotiating", "value": "$85,000", "role": "Sales", "score": 42500 },
  { "type": "position", "id": "uuid", "label": "SMCI long", "value": "+$1,200", "role": "Trading", "score": 1200 }
]
```

**next_actions:**
```json
[
  { "type": "stale_deal", "text": "Follow up with Acme (5d stale)", "icon": "Phone", "age": 5, "target_id": "uuid" },
  { "type": "no_stoploss", "text": "Set stop-loss for SMCI", "icon": "TrendingUp", "target_id": "uuid" }
]
```

**waiting_on:**
```json
[
  { "id": "uuid", "action": "Quote response", "contact": "John", "company": "Acme", "days": 4 }
]
```

**waste_alerts:**
```json
[
  { "id": "stale-deals", "type": "stale_deals", "text": "2 deals going stale (7+ days)", "severity": "high" },
  { "id": "no-stoploss", "type": "no_stoploss", "text": "1 position with no stop-loss", "severity": "high" }
]
```

## Edge Function: `today-compute`

**Location:** `supabase/functions/today-compute/index.ts`

**Invocation:**
```
POST /functions/v1/today-compute
  ?mode=cron     → all users
  ?mode=trigger  → body: { user_id }
  ?mode=manual   → body: { user_id }
```

**Pipeline:**
1. Get user list (cron) or single user_id (trigger/manual)
2. For each user, query source tables: deals, follow_ups, positions, habits, expenses, trade_journal
3. Compute:
   - `hero_stats`: count/sum from source data
   - `top_five`: score deals by value×probability, positions by abs(pnl), urgent follow-ups at 100k. Sort, take 5.
   - `next_actions`: stale deals (3+ days), missing stop-losses, unlogged habits. Max 4.
   - `waiting_on`: follow_ups where status='waiting', join contacts/deals
   - `waste_alerts`: stale deals (7+ days), due expenses, missing stop-losses, broken streaks
   - `suggestions`: new jarvis_suggestions rows for actionable items
4. Upsert `today_intelligence` row
5. Insert new `jarvis_suggestions` entries

**Auth:** Uses `SUPABASE_SERVICE_ROLE_KEY` to bypass RLS (server-side function processing all users on cron).

## Edge Function: `external-sync` (skeleton)

**Location:** `supabase/functions/external-sync/index.ts`

**Invocation:**
```
POST /functions/v1/external-sync?source=pipedrive
POST /functions/v1/external-sync?source=trading
```

**Current behavior:** Validates the webhook payload, logs it, returns 200. Does NOT write to tables yet. Includes mapping skeletons with TODO comments for Pipedrive deal→deals and Pipedrive person→contacts mapping.

**Future behavior (when API keys provided):**
- Pipedrive: maps deal updates → upserts into `deals` table → DB trigger fires `today-compute`
- Trading: maps position updates → upserts into `positions` table → DB trigger fires `today-compute`

## Database Triggers

Postgres triggers on `deals`, `follow_ups`, `positions` that call `pg_net.http_post()` to invoke `today-compute` with `mode=trigger`.

```sql
create or replace function notify_today_compute() returns trigger as $$
begin
  perform net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/today-compute?mode=trigger',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
    body := jsonb_build_object('user_id', coalesce(new.user_id, old.user_id))
  );
  return coalesce(new, old);
end;
$$ language plpgsql security definer;

create trigger deals_today_compute after insert or update or delete on deals
  for each row execute function notify_today_compute();

create trigger follow_ups_today_compute after insert or update or delete on follow_ups
  for each row execute function notify_today_compute();

create trigger positions_today_compute after insert or update or delete on positions
  for each row execute function notify_today_compute();
```

**Note:** `pg_net` extension must be enabled. Supabase URL and service role key are set via `app.settings` config vars in the Supabase dashboard (Settings → Database → Custom Configuration).

If `pg_net` is not available, falls back to the cron-only approach (15min refresh).

## Cron Jobs (pg_cron)

```sql
-- Every 15min during work hours (6am-8pm)
select cron.schedule('today-compute-frequent', '*/15 6-20 * * *', $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/today-compute?mode=cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )
$$);

-- Overnight at 9pm, midnight, 3am
select cron.schedule('today-compute-overnight', '0 21,0,3 * * *', $$
  select net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/today-compute?mode=cron',
    headers := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'), 'Content-Type', 'application/json'),
    body := '{}'::jsonb
  )
$$);
```

## Frontend Changes

### Modified: `src/hooks/useTodaySupa.js`

Replace all 6 parallel queries with a single query + Realtime subscription:

```js
// Read precomputed intelligence
const { data } = await supabase
  .from("today_intelligence")
  .select("*")
  .eq("date", todayIso())
  .maybeSingle();

// Subscribe to changes
supabase.channel("today-intel")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "today_intelligence",
  }, () => refresh())
  .subscribe();
```

Also subscribe to `jarvis_suggestions` for proactive alert toasts.

### Modified: `src/views/Today.jsx`

Components receive precomputed JSONB arrays directly instead of raw table data. No more client-side scoring, filtering, or aggregation.

### New: Notification toast for proactive alerts

When `jarvis_suggestions` gets a new row, show a non-blocking toast: "JARVIS: Follow up with Acme — deal going stale (5d)".

## Env Vars / Secrets

| Secret | Where | Required |
|---|---|---|
| `SUPABASE_URL` | Edge Function env | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function env (secret) | Yes |
| `app.settings.supabase_url` | Supabase DB config | Yes (for pg_net triggers) |
| `app.settings.service_role_key` | Supabase DB config | Yes (for pg_net triggers) |

## Setup Steps (manual, one-time)

1. Enable `pg_net` extension: Supabase Dashboard → Database → Extensions → enable `pg_net`
2. Enable `pg_cron` extension: same location → enable `pg_cron`
3. Set DB config vars: Settings → Database → add `app.settings.supabase_url` and `app.settings.service_role_key`
4. Enable Realtime on `today_intelligence`: Database → Replication → add table
5. Deploy Edge Functions: `supabase functions deploy today-compute` and `supabase functions deploy external-sync`
6. Set Edge Function secrets: `supabase secrets set SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=...`

## What's Automatic vs Manual After This Ships

| What | Status |
|---|---|
| Dashboard refresh on deal/position/follow-up change | Automatic (DB trigger → Edge Function → Realtime) |
| Dashboard refresh every 15min during work hours | Automatic (pg_cron) |
| Page load speed | <100ms (1 precomputed row read) |
| Proactive alerts for stale deals / risk | Automatic (Edge Function → jarvis_suggestions → toast) |
| Adding a new deal | Manual (user enters in Work page) |
| Logging a trade | Manual (user enters in Money page) |
| End of day review | Manual (user fills form after 5pm) |
| Pipedrive sync | Skeleton built, not wired (needs API key + webhook URL) |
| Trading API sync | Skeleton built, not wired (needs market data API) |

## File Summary

| File | Action |
|---|---|
| `supabase/migrations/20260412_today_intelligence.sql` | Create table + triggers + cron |
| `supabase/functions/today-compute/index.ts` | Edge Function: compute intelligence |
| `supabase/functions/external-sync/index.ts` | Edge Function: webhook skeleton |
| `src/hooks/useTodaySupa.js` | Modify: single query + Realtime subscription |
| `src/views/Today.jsx` | Modify: read precomputed JSONB |
| `src/components/today/NotificationToast.jsx` | New: proactive alert toast |
