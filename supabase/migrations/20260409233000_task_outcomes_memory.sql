-- ============================================================
-- First-class persisted mission outcome memory
-- ============================================================

CREATE TABLE IF NOT EXISTS task_outcomes (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id            text REFERENCES tasks(id) ON DELETE SET NULL,
  root_mission_id    text,
  agent_id           text REFERENCES agents(id) ON DELETE SET NULL,
  outcome_status     text NOT NULL DEFAULT 'completed',
  score              integer NOT NULL DEFAULT 50,
  trust              text NOT NULL DEFAULT 'medium',
  doctrine_feedback  text NOT NULL DEFAULT '',
  model              text,
  provider           text,
  domain             text NOT NULL DEFAULT 'general',
  intent_type        text NOT NULL DEFAULT 'general',
  budget_class       text NOT NULL DEFAULT 'balanced',
  risk_level         text NOT NULL DEFAULT 'medium',
  approval_level     text NOT NULL DEFAULT 'risk_weighted',
  execution_strategy text NOT NULL DEFAULT 'sequential',
  cost_usd           numeric(12,4) NOT NULL DEFAULT 0,
  duration_ms        integer NOT NULL DEFAULT 0,
  context_pack_ids   jsonb NOT NULL DEFAULT '[]'::jsonb,
  required_capabilities jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_outcomes_user ON task_outcomes(user_id);
CREATE INDEX IF NOT EXISTS idx_task_outcomes_root ON task_outcomes(root_mission_id);
CREATE INDEX IF NOT EXISTS idx_task_outcomes_task ON task_outcomes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_outcomes_created ON task_outcomes(created_at DESC);

DO $$ BEGIN
  CREATE UNIQUE INDEX idx_task_outcomes_task_status_unique
    ON task_outcomes(task_id, outcome_status);
EXCEPTION
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE task_outcomes ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY task_outcomes_user_policy ON task_outcomes
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER task_outcomes_updated_at BEFORE UPDATE ON task_outcomes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
