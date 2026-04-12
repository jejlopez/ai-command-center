-- Work Sales Command Center — precomputed intelligence table

create table if not exists work_intelligence (
  id                uuid default gen_random_uuid() primary key,
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date              date not null default current_date,
  pipeline_stats    jsonb not null default '{}',
  deal_board        jsonb not null default '{}',
  follow_up_queue   jsonb not null default '[]',
  contacts_summary  jsonb not null default '[]',
  deal_velocity     jsonb not null default '{}',
  computed_at       timestamptz not null default now(),
  unique(user_id, date)
);

alter table work_intelligence enable row level security;
create policy "work_intelligence_owner" on work_intelligence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_work_intelligence_user_date
  on work_intelligence(user_id, date);

alter publication supabase_realtime add table work_intelligence;

-- Trigger on contacts changes to recompute work intelligence
create trigger contacts_today_compute
  after insert or update or delete on contacts
  for each row execute function notify_today_compute();
