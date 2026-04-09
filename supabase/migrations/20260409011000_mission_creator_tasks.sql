-- Migration: expand tasks for Mission Control creator + lifecycle

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'queued';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'blocked';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'needs_approval';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'done';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'failed';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_mode AS ENUM ('fast', 'balanced', 'efficient');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_lane AS ENUM ('critical', 'active', 'blocked', 'approvals', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_schedule_type AS ENUM ('once', 'recurring');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_output_type AS ENUM ('summary', 'email_drafts', 'crm_notes', 'report', 'custom');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE task_target_type AS ENUM ('pipedrive_deal', 'pipedrive_person', 'internal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS mode task_mode NOT NULL DEFAULT 'balanced';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS lane task_lane NOT NULL DEFAULT 'active';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 5;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS schedule_type task_schedule_type NOT NULL DEFAULT 'once';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS run_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS recurrence_rule jsonb;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_type task_output_type NOT NULL DEFAULT 'summary';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS output_spec text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_type task_target_type NOT NULL DEFAULT 'internal';
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS target_identifier text;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS created_by_commander_id text REFERENCES agents(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_run_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS next_run_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_cost_cents integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS actual_cost_cents integer;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS started_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS cancelled_at timestamptz;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS failed_at timestamptz;

UPDATE tasks
SET
  title = COALESCE(title, name),
  description = COALESCE(description, prompt_text, name),
  lane = CASE
    WHEN status IN ('completed', 'done') THEN 'completed'::task_lane
    WHEN status IN ('failed', 'error', 'blocked', 'cancelled') THEN 'blocked'::task_lane
    WHEN status = 'needs_approval' THEN 'approvals'::task_lane
    ELSE 'active'::task_lane
  END,
  actual_cost_cents = COALESCE(actual_cost_cents, ROUND(COALESCE(cost_usd, 0) * 100)::integer),
  last_run_at = COALESCE(last_run_at, completed_at),
  progress_percent = CASE
    WHEN status IN ('completed', 'done') THEN 100
    WHEN status IN ('failed', 'error', 'blocked', 'cancelled') THEN progress_percent
    ELSE COALESCE(progress_percent, 0)
  END
WHERE true;

CREATE INDEX IF NOT EXISTS idx_tasks_lane ON tasks(lane);
CREATE INDEX IF NOT EXISTS idx_tasks_run_at ON tasks(run_at);
CREATE INDEX IF NOT EXISTS idx_tasks_schedule_type ON tasks(schedule_type);
