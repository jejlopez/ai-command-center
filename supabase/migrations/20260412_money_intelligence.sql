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
