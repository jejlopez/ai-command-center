-- ============================================================
-- First-class specialist lifecycle memory
-- ============================================================

CREATE TABLE IF NOT EXISTS specialist_lifecycle (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id          uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id         text REFERENCES agents(id) ON DELETE SET NULL,
  root_mission_id  text,
  event_type       text NOT NULL DEFAULT 'spawned',
  event_source     text NOT NULL DEFAULT 'runtime',
  role             text NOT NULL DEFAULT 'specialist',
  provider         text,
  model            text,
  is_ephemeral     boolean NOT NULL DEFAULT true,
  message          text NOT NULL DEFAULT '',
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_specialist_lifecycle_user ON specialist_lifecycle(user_id);
CREATE INDEX IF NOT EXISTS idx_specialist_lifecycle_agent ON specialist_lifecycle(agent_id);
CREATE INDEX IF NOT EXISTS idx_specialist_lifecycle_root ON specialist_lifecycle(root_mission_id);
CREATE INDEX IF NOT EXISTS idx_specialist_lifecycle_type ON specialist_lifecycle(event_type);
CREATE INDEX IF NOT EXISTS idx_specialist_lifecycle_created ON specialist_lifecycle(created_at DESC);

ALTER TABLE specialist_lifecycle ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY specialist_lifecycle_user_policy ON specialist_lifecycle
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER specialist_lifecycle_updated_at BEFORE UPDATE ON specialist_lifecycle
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
