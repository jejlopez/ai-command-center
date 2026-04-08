-- Per-user banks for models and skills, plus integrity guards to ensure
-- cross-table references never point at another user's data.

CREATE TABLE IF NOT EXISTS model_bank (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_key     text NOT NULL,
  label         text NOT NULL,
  provider      text NOT NULL DEFAULT 'Custom',
  cost_per_1k   numeric(10,4) NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, model_key)
);

CREATE TABLE IF NOT EXISTS skill_bank (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text DEFAULT '',
  icon          text DEFAULT 'Zap',
  source        text NOT NULL DEFAULT 'custom',
  reference     text,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_model_bank_user ON model_bank(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_bank_user ON skill_bank(user_id);

ALTER TABLE model_bank ENABLE ROW LEVEL SECURITY;
ALTER TABLE skill_bank ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY model_bank_user_policy ON model_bank
    FOR ALL
    TO authenticated
    USING ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY skill_bank_user_policy ON skill_bank
    FOR ALL
    TO authenticated
    USING ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id)
    WITH CHECK ((select auth.uid()) IS NOT NULL AND (select auth.uid()) = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE OR REPLACE FUNCTION set_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER model_bank_updated_at BEFORE UPDATE ON model_bank
    FOR EACH ROW EXECUTE FUNCTION set_timestamp_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER skill_bank_updated_at BEFORE UPDATE ON skill_bank
    FOR EACH ROW EXECUTE FUNCTION set_timestamp_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

INSERT INTO model_bank (user_id, model_key, label, provider)
SELECT DISTINCT user_id, model, model, 'Imported'
FROM agents
WHERE model IS NOT NULL
ON CONFLICT (user_id, model_key) DO NOTHING;

INSERT INTO skill_bank (id, user_id, name, description, source)
SELECT DISTINCT skill_id, a.user_id, skill_id, 'Imported existing skill reference', 'imported'
FROM agents a
CROSS JOIN LATERAL unnest(coalesce(a.skills, '{}')) AS skill_id
WHERE skill_id IS NOT NULL AND skill_id <> ''
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_same_user_references()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'agents' THEN
    IF NEW.model IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM model_bank
      WHERE model_bank.user_id = NEW.user_id
        AND model_bank.model_key = NEW.model
    ) THEN
      RAISE EXCEPTION 'Model % is not stored in user % model bank', NEW.model, NEW.user_id;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM unnest(coalesce(NEW.skills, '{}')) AS skill_id
      WHERE NOT EXISTS (
        SELECT 1 FROM skill_bank
        WHERE skill_bank.id = skill_id
          AND skill_bank.user_id = NEW.user_id
      )
    ) THEN
      RAISE EXCEPTION 'One or more skills are not stored in user % skill bank', NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'tasks' THEN
    IF NEW.parent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM tasks parent_task
      WHERE parent_task.id = NEW.parent_id
        AND parent_task.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Task parent % does not belong to user %', NEW.parent_id, NEW.user_id;
    END IF;

    IF NEW.agent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = NEW.agent_id
        AND agents.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Agent % does not belong to user %', NEW.agent_id, NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'activity_log' THEN
    IF NEW.agent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = NEW.agent_id
        AND agents.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Agent % does not belong to user %', NEW.agent_id, NEW.user_id;
    END IF;

    IF NEW.parent_log_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM activity_log parent_log
      WHERE parent_log.id = NEW.parent_log_id
        AND parent_log.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Parent log % does not belong to user %', NEW.parent_log_id, NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'pending_reviews' THEN
    IF NEW.agent_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM agents
      WHERE agents.id = NEW.agent_id
        AND agents.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Agent % does not belong to user %', NEW.agent_id, NEW.user_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'approval_audit' THEN
    IF NOT EXISTS (
      SELECT 1 FROM pending_reviews review
      WHERE review.id = NEW.review_id
        AND review.user_id = NEW.user_id
    ) THEN
      RAISE EXCEPTION 'Review % does not belong to user %', NEW.review_id, NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS agents_same_user_guard ON agents;
CREATE TRIGGER agents_same_user_guard
  BEFORE INSERT OR UPDATE ON agents
  FOR EACH ROW EXECUTE FUNCTION enforce_same_user_references();

DROP TRIGGER IF EXISTS tasks_same_user_guard ON tasks;
CREATE TRIGGER tasks_same_user_guard
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_same_user_references();

DROP TRIGGER IF EXISTS activity_log_same_user_guard ON activity_log;
CREATE TRIGGER activity_log_same_user_guard
  BEFORE INSERT OR UPDATE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION enforce_same_user_references();

DROP TRIGGER IF EXISTS pending_reviews_same_user_guard ON pending_reviews;
CREATE TRIGGER pending_reviews_same_user_guard
  BEFORE INSERT OR UPDATE ON pending_reviews
  FOR EACH ROW EXECUTE FUNCTION enforce_same_user_references();

DROP TRIGGER IF EXISTS approval_audit_same_user_guard ON approval_audit;
CREATE TRIGGER approval_audit_same_user_guard
  BEFORE INSERT OR UPDATE ON approval_audit
  FOR EACH ROW EXECUTE FUNCTION enforce_same_user_references();
