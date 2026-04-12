-- Today Auto-Intelligence Layer
-- Precomputed dashboard state + DB triggers + cron schedules

-- 1. Intelligence table (one row per user per day)
create table if not exists today_intelligence (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  date        date not null default current_date,
  hero_stats  jsonb not null default '{}',
  top_five    jsonb not null default '[]',
  next_actions jsonb not null default '[]',
  waiting_on  jsonb not null default '[]',
  waste_alerts jsonb not null default '[]',
  suggestions jsonb not null default '[]',
  computed_at timestamptz not null default now(),
  unique(user_id, date)
);

alter table today_intelligence enable row level security;
create policy "today_intelligence_owner" on today_intelligence
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_today_intelligence_user_date
  on today_intelligence(user_id, date);

-- 2. Enable Realtime on today_intelligence
alter publication supabase_realtime add table today_intelligence;

-- 3. Enable Realtime on jarvis_suggestions for proactive alert toasts
alter publication supabase_realtime add table jarvis_suggestions;

-- 4. Enable pg_net extension (for triggers calling Edge Functions)
create extension if not exists pg_net with schema extensions;

-- 5. Trigger function: calls today-compute Edge Function on source table changes
create or replace function notify_today_compute() returns trigger as $$
declare
  _url text;
  _key text;
begin
  begin
    _url := current_setting('app.settings.supabase_url', true);
    _key := current_setting('app.settings.service_role_key', true);
  exception when others then
    return coalesce(new, old);
  end;

  if _url is null or _key is null then
    return coalesce(new, old);
  end if;

  perform net.http_post(
    url := _url || '/functions/v1/today-compute?mode=trigger',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || _key,
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('user_id', coalesce(new.user_id, old.user_id))
  );

  return coalesce(new, old);
end;
$$ language plpgsql security definer;

-- 6. Attach triggers to source tables
create trigger deals_today_compute
  after insert or update or delete on deals
  for each row execute function notify_today_compute();

create trigger follow_ups_today_compute
  after insert or update or delete on follow_ups
  for each row execute function notify_today_compute();

create trigger positions_today_compute
  after insert or update or delete on positions
  for each row execute function notify_today_compute();

-- 7. Cron schedules (requires pg_cron — enable in Dashboard if not available)
do $$
begin
  perform cron.schedule(
    'today-compute-frequent',
    '*/15 6-20 * * *',
    $cron$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/today-compute?mode=cron',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
    $cron$
  );

  perform cron.schedule(
    'today-compute-overnight',
    '0 21,0,3 * * *',
    $cron$
    select net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/today-compute?mode=cron',
      headers := jsonb_build_object(
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
        'Content-Type', 'application/json'
      ),
      body := '{}'::jsonb
    )
    $cron$
  );
exception when others then
  raise notice 'pg_cron not available — set up cron schedules manually in Supabase Dashboard';
end;
$$;
