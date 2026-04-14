-- Pipedrive polling sync — state tracking

create table if not exists sync_state (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  provider    text not null,                    -- 'pipedrive'
  resource    text not null,                    -- 'deals', 'persons', 'activities'
  last_sync   timestamptz not null default '2000-01-01',
  last_status text default 'ok',               -- ok, error, rate_limited
  error_msg   text,
  backoff_until timestamptz,                    -- circuit breaker: don't sync until this time
  created_at  timestamptz default now(),
  unique(user_id, provider, resource)
);

alter table sync_state enable row level security;
create policy "sync_state_owner" on sync_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Add pipedrive_id columns to existing tables for deduplication
alter table deals add column if not exists pipedrive_id int;
alter table contacts add column if not exists pipedrive_id int;
alter table follow_ups add column if not exists pipedrive_id int;

create unique index if not exists idx_deals_pipedrive on deals(user_id, pipedrive_id) where pipedrive_id is not null;
create unique index if not exists idx_contacts_pipedrive on contacts(user_id, pipedrive_id) where pipedrive_id is not null;

-- Smart cron schedule for Pipedrive polling
-- Business hours (8am-6pm ET): every 5 min
-- After hours: every 30 min
-- We use a single 5-min cron and let the function decide whether to skip

do $$
begin
  perform cron.schedule(
    'pipedrive-sync',
    '*/5 * * * *',
    $cron$
    select net.http_post(
      url := 'https://bqlmkaapurfxdmqcuvla.supabase.co/functions/v1/pipedrive-sync',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    )
    $cron$
  );
exception when others then
  raise notice 'pg_cron not available for pipedrive-sync — set up manually';
end;
$$;
