-- Today page upgrade — decision queue, time audit, compound tracking

create table if not exists decisions (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  context     text,
  cost_per_day real default 0,        -- opportunity cost of not deciding
  role        text default 'general', -- sales, trading, build, general
  status      text default 'pending', -- pending, decided, deferred
  decided_at  timestamptz,
  outcome     text,
  created_at  timestamptz default now()
);
alter table decisions enable row level security;
create policy "decisions_owner" on decisions for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists time_blocks_actual (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  role        text not null,           -- sales, trading, build, admin, personal
  minutes     int not null default 0,
  notes       text,
  created_at  timestamptz default now()
);
alter table time_blocks_actual enable row level security;
create policy "time_blocks_actual_owner" on time_blocks_actual for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists compound_tracker (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  improvement text not null,
  category    text default 'general',  -- sales, trading, build, health, money
  impact      text,                    -- description of impact
  created_at  timestamptz default now()
);
alter table compound_tracker enable row level security;
create policy "compound_tracker_owner" on compound_tracker for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists not_to_do (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  item        text not null,
  reason      text,
  added_at    timestamptz default now(),
  active      boolean default true
);
alter table not_to_do enable row level security;
create policy "not_to_do_owner" on not_to_do for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table decisions;
alter publication supabase_realtime add table compound_tracker;
