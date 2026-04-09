-- ============================================================
-- Migration 005: task_notes, acknowledged_at, snoozed_until
-- Scope: Mission Control Phase 2
-- ============================================================

-- ── Task Notes (append-only per task) ────────────────────────

CREATE TABLE IF NOT EXISTS task_notes (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  task_id     text,                                            -- references tasks.id or pending_reviews.id
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author      text NOT NULL DEFAULT 'Human',                   -- 'Human' | agent name
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_notes_task ON task_notes(task_id);
CREATE INDEX IF NOT EXISTS idx_task_notes_user ON task_notes(user_id);

ALTER TABLE task_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY task_notes_user_policy ON task_notes
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── Acknowledge column on tasks ──────────────────────────────

DO $$ BEGIN
  ALTER TABLE tasks ADD COLUMN acknowledged_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Acknowledge column on pending_reviews ────────────────────

DO $$ BEGIN
  ALTER TABLE pending_reviews ADD COLUMN acknowledged_at timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- ── Snooze column on pending_reviews ─────────────────────────

DO $$ BEGIN
  ALTER TABLE pending_reviews ADD COLUMN snoozed_until timestamptz;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;
