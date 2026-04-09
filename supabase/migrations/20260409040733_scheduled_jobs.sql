-- ============================================================
-- Migration: scheduled_jobs
-- Scope: Overview schedule visibility + mission readiness
-- ============================================================

DO $$ BEGIN
  CREATE TYPE scheduled_job_status AS ENUM ('active', 'paused', 'error');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE scheduled_job_run_status AS ENUM ('never', 'success', 'failed', 'running', 'missed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id                    text PRIMARY KEY,
  user_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id              text REFERENCES agents(id) ON DELETE SET NULL,
  agent_name            text NOT NULL,
  name                  text NOT NULL,
  schedule_label        text NOT NULL,
  status                scheduled_job_status NOT NULL DEFAULT 'active',
  approval_required     boolean NOT NULL DEFAULT false,
  next_run_at           timestamptz,
  last_run_at           timestamptz,
  last_run_status       scheduled_job_run_status NOT NULL DEFAULT 'never',
  estimated_duration_ms integer NOT NULL DEFAULT 0,
  estimated_cost_usd    numeric(10,4) NOT NULL DEFAULT 0,
  last_error            text,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_user ON scheduled_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_next_run ON scheduled_jobs(user_id, next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_status ON scheduled_jobs(user_id, status);

ALTER TABLE scheduled_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY scheduled_jobs_user_policy ON scheduled_jobs
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER scheduled_jobs_updated_at BEFORE UPDATE ON scheduled_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
