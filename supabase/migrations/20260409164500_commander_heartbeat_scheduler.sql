-- Always-on commander heartbeat
-- Schedules a once-per-minute pulse that invokes the commander-heartbeat
-- edge function so queued missions can move even when no client is open.

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid
  INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'commander-heartbeat-every-minute'
  LIMIT 1;

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END $$;

SELECT cron.schedule(
  'commander-heartbeat-every-minute',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://bqlmkaapurfxdmqcuvla.supabase.co/functions/v1/commander-heartbeat',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
