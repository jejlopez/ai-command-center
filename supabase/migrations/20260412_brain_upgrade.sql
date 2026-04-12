create table if not exists decision_journal (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  context     text,
  reasoning   text not null,
  outcome     text,
  lesson      text,
  category    text default 'general', -- sales, trading, build, life
  decided_at  timestamptz default now(),
  reviewed_at timestamptz,
  created_at  timestamptz default now()
);
alter table decision_journal enable row level security;
create policy "decision_journal_owner" on decision_journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists mental_models (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  description text not null,
  when_to_use text,
  category    text default 'general', -- investing, negotiation, systems, decision
  times_used  int default 0,
  created_at  timestamptz default now()
);
alter table mental_models enable row level security;
create policy "mental_models_owner" on mental_models for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists reading_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title       text not null,
  author      text,
  type        text default 'book',    -- book, article, podcast, video
  key_takeaways text,
  rating      int,                    -- 1-5
  finished_at date,
  created_at  timestamptz default now()
);
alter table reading_log enable row level security;
create policy "reading_log_owner" on reading_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists mistake_journal (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mistake     text not null,
  context     text,
  lesson      text not null,
  category    text default 'general',
  cost_usd    real,
  prevented_next boolean default false,
  occurred_at date default current_date,
  created_at  timestamptz default now()
);
alter table mistake_journal enable row level security;
create policy "mistake_journal_owner" on mistake_journal for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

alter publication supabase_realtime add table decision_journal;
alter publication supabase_realtime add table mental_models;
alter publication supabase_realtime add table reading_log;
alter publication supabase_realtime add table mistake_journal;
