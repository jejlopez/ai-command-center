-- M2B2 Today Cockpit — 11 data tables
-- contacts must come before deals (FK dependency)

-- 1. contacts
create table if not exists contacts (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  company       text,
  role          text,
  email         text,
  phone         text,
  last_interaction timestamptz,
  follow_up_due    timestamptz,
  notes         text,
  created_at    timestamptz default now()
);
alter table contacts enable row level security;
create policy "owner only" on contacts
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 2. deals
create table if not exists deals (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  company       text not null,
  contact_name  text,
  contact_id    uuid references contacts(id) on delete set null,
  stage         text not null default 'prospect',
  value_usd     numeric,
  probability   numeric,
  close_date    date,
  last_touch    timestamptz,
  notes         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
alter table deals enable row level security;
create policy "owner only" on deals
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3. follow_ups
create table if not exists follow_ups (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  deal_id       uuid references deals(id) on delete cascade,
  contact_id    uuid references contacts(id) on delete set null,
  action        text not null,
  due_date      timestamptz,
  status        text not null default 'pending',
  priority      text not null default 'normal',
  completed_at  timestamptz,
  notes         text,
  created_at    timestamptz default now()
);
alter table follow_ups enable row level security;
create policy "owner only" on follow_ups
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 4. positions
create table if not exists positions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  side          text not null default 'long',
  entry_price   numeric,
  size          numeric,
  current_price numeric,
  stop_loss     numeric,
  target        numeric,
  status        text not null default 'open',
  pnl_usd       numeric default 0,
  opened_at     timestamptz,
  closed_at     timestamptz,
  notes         text
);
alter table positions enable row level security;
create policy "owner only" on positions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 5. watchlist
create table if not exists watchlist (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  ticker        text not null,
  alert_price   numeric,
  direction     text,
  notes         text,
  added_at      timestamptz default now()
);
alter table watchlist enable row level security;
create policy "owner only" on watchlist
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 6. trade_journal
create table if not exists trade_journal (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null default current_date,
  pnl_usd       numeric,
  wins          integer,
  losses        integer,
  notes         text,
  lessons       text,
  created_at    timestamptz default now(),
  unique(user_id, date)
);
alter table trade_journal enable row level security;
create policy "owner only" on trade_journal
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7. daily_snapshot
create table if not exists daily_snapshot (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  date             date not null default current_date,
  open_deals       integer,
  pipeline_value   numeric,
  deals_touched    integer,
  trading_pnl      numeric,
  trades_taken     integer,
  meetings_count   integer,
  tasks_completed  integer,
  focus_hours      numeric,
  energy_score     integer,
  sleep_hours      numeric,
  ai_spend_usd     numeric,
  notes            text,
  created_at       timestamptz default now(),
  unique(user_id, date)
);
alter table daily_snapshot enable row level security;
create policy "owner only" on daily_snapshot
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 8. expenses
create table if not exists expenses (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  name          text not null,
  amount_usd    numeric not null,
  category      text not null default 'other',
  frequency     text not null default 'monthly',
  next_due      date,
  active        boolean not null default true,
  notes         text,
  created_at    timestamptz default now()
);
alter table expenses enable row level security;
create policy "owner only" on expenses
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 9. health_log
create table if not exists health_log (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  date          date not null default current_date,
  sleep_hours   numeric,
  energy        integer,
  workout       boolean not null default false,
  workout_type  text,
  notes         text,
  created_at    timestamptz default now(),
  unique(user_id, date)
);
alter table health_log enable row level security;
create policy "owner only" on health_log
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 10. habits
create table if not exists habits (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  frequency      text not null default 'daily',
  current_streak integer not null default 0,
  best_streak    integer not null default 0,
  last_done      date,
  active         boolean not null default true,
  created_at     timestamptz default now()
);
alter table habits enable row level security;
create policy "owner only" on habits
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 11. jarvis_suggestions
create table if not exists jarvis_suggestions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text,
  suggestion  text not null,
  context     jsonb,
  acted_on    boolean,
  outcome     text,
  created_at  timestamptz default now()
);
alter table jarvis_suggestions enable row level security;
create policy "owner only" on jarvis_suggestions
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Indexes for Today cockpit queries
create index if not exists idx_deals_user_stage          on deals(user_id, stage);
create index if not exists idx_follow_ups_user_status    on follow_ups(user_id, status, due_date);
create index if not exists idx_positions_user_status     on positions(user_id, status);
create index if not exists idx_daily_snapshot_user_date  on daily_snapshot(user_id, date);
create index if not exists idx_health_log_user_date      on health_log(user_id, date);
create index if not exists idx_habits_user_active        on habits(user_id, active);
create index if not exists idx_expenses_user_active      on expenses(user_id, active);
