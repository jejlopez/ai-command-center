-- ============================================================
-- Persistent learning memory for cross-page doctrine
-- ============================================================

CREATE TABLE IF NOT EXISTS learning_memory (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctrine_key   text NOT NULL,
  owner          text NOT NULL,
  tone           text NOT NULL DEFAULT 'teal',
  title          text NOT NULL,
  detail         text NOT NULL,
  confidence     integer NOT NULL DEFAULT 50,
  evidence       jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics        jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_hash  text NOT NULL DEFAULT '',
  first_seen_at  timestamptz NOT NULL DEFAULT now(),
  last_seen_at   timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT learning_memory_user_doctrine_unique UNIQUE (user_id, doctrine_key)
);

CREATE INDEX IF NOT EXISTS idx_learning_memory_user ON learning_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_memory_doctrine ON learning_memory(doctrine_key);

CREATE TABLE IF NOT EXISTS learning_memory_history (
  id                 bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  learning_memory_id bigint NOT NULL REFERENCES learning_memory(id) ON DELETE CASCADE,
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doctrine_key       text NOT NULL,
  title              text NOT NULL,
  detail             text NOT NULL,
  confidence         integer NOT NULL DEFAULT 50,
  evidence           jsonb NOT NULL DEFAULT '[]'::jsonb,
  metrics            jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_hash      text NOT NULL DEFAULT '',
  observed_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_memory_history_user ON learning_memory_history(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_memory_history_doctrine ON learning_memory_history(doctrine_key);
CREATE INDEX IF NOT EXISTS idx_learning_memory_history_observed ON learning_memory_history(observed_at DESC);

DO $$ BEGIN
  ALTER TABLE learning_memory_history
    ADD CONSTRAINT learning_memory_history_snapshot_unique UNIQUE (learning_memory_id, snapshot_hash);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE learning_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_memory_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY learning_memory_user_policy ON learning_memory
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY learning_memory_history_user_policy ON learning_memory_history
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER learning_memory_updated_at BEFORE UPDATE ON learning_memory
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
