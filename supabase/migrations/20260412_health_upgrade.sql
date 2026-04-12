create table if not exists peak_hours (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  hour        int not null,            -- 0-23
  role        text not null,           -- sales, trading, build
  performance int default 5,           -- 1-10 self-rated
  created_at  timestamptz default now()
);
alter table peak_hours enable row level security;
create policy "peak_hours_owner" on peak_hours for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists non_negotiables (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  habit       text not null,
  current_streak int default 0,
  best_streak int default 0,
  last_done   date,
  active      boolean default true,
  created_at  timestamptz default now()
);
alter table non_negotiables enable row level security;
create policy "non_negotiables_owner" on non_negotiables for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table non_negotiables;
