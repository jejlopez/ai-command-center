-- Money page upgrade — ROI tracking, projections

create table if not exists tool_roi (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  monthly_cost real not null,
  monthly_value real default 0,        -- estimated value generated
  category    text default 'tool',     -- tool, subscription, service
  notes       text,
  created_at  timestamptz default now()
);
alter table tool_roi enable row level security;
create policy "tool_roi_owner" on tool_roi for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
alter publication supabase_realtime add table tool_roi;
