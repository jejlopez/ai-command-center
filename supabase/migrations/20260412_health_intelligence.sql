-- Health Performance Monitor — precomputed intelligence table

create table if not exists health_intelligence (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date            date not null default current_date,
  energy_hero     jsonb not null default '{}',
  habit_tracker   jsonb not null default '[]',
  weekly_trends   jsonb not null default '[]',
  risk_alerts     jsonb not null default '[]',
  recovery_score  jsonb not null default '{}',
  computed_at     timestamptz not null default now(),
  unique(user_id, date)
);

alter table health_intelligence enable row level security;
create policy "health_intelligence_owner" on health_intelligence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_health_intelligence_user_date
  on health_intelligence(user_id, date);

alter publication supabase_realtime add table health_intelligence;

-- Trigger on health_log to recompute intelligence on change
create trigger health_log_today_compute
  after insert or update or delete on health_log
  for each row execute function notify_today_compute();

-- Trigger on habits to recompute intelligence on change
create trigger habits_health_today_compute
  after insert or update or delete on habits
  for each row execute function notify_today_compute();
