-- ============================================================
-- First-class persisted mission intervention memory
-- ============================================================

CREATE TABLE IF NOT EXISTS task_interventions (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id        text REFERENCES tasks(id) ON DELETE SET NULL,
  root_mission_id text,
  agent_id       text REFERENCES agents(id) ON DELETE SET NULL,
  event_type     text NOT NULL DEFAULT 'override',
  event_source   text NOT NULL DEFAULT 'runtime',
  tone           text NOT NULL DEFAULT 'blue',
  message        text NOT NULL DEFAULT '',
  domain         text NOT NULL DEFAULT 'general',
  intent_type    text NOT NULL DEFAULT 'general',
  provider       text,
  model          text,
  schedule_type  text NOT NULL DEFAULT 'once',
  metadata       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_interventions_user ON task_interventions(user_id);
CREATE INDEX IF NOT EXISTS idx_task_interventions_root ON task_interventions(root_mission_id);
CREATE INDEX IF NOT EXISTS idx_task_interventions_task ON task_interventions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_interventions_event_type ON task_interventions(event_type);
CREATE INDEX IF NOT EXISTS idx_task_interventions_created ON task_interventions(created_at DESC);

ALTER TABLE task_interventions ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY task_interventions_user_policy ON task_interventions
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER task_interventions_updated_at BEFORE UPDATE ON task_interventions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
