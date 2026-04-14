-- Email intelligence — style learning, auto-linking, cleanup tracking

create table if not exists email_style (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  original_draft text not null,     -- what JARVIS drafted
  edited_draft text not null,       -- what user changed it to
  deal_id     uuid,
  contact_id  uuid,
  context     text,                 -- what type of email: follow_up, intro, proposal, reply
  created_at  timestamptz default now()
);
alter table email_style enable row level security;
create policy "email_style_owner" on email_style for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists email_cleanup_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date default current_date,
  archived    int default 0,
  deleted     int default 0,
  kept        int default 0,
  created_at  timestamptz default now()
);
alter table email_cleanup_log enable row level security;
create policy "email_cleanup_log_owner" on email_cleanup_log for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
