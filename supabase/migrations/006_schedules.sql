-- ============================================================
-- Migration 006: schedules table
-- Scope: Mission Control Phase 3 — Planner tab
-- ============================================================

CREATE TABLE IF NOT EXISTS schedules (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  agent_id      text,                                     -- references agents.id
  cron_expr     text NOT NULL DEFAULT '0 9 * * 1-5',     -- cron expression
  cadence_label text NOT NULL DEFAULT 'Weekdays 9 AM',   -- human-readable
  enabled       boolean NOT NULL DEFAULT true,
  approval_required boolean NOT NULL DEFAULT false,
  estimated_minutes integer DEFAULT 2,
  estimated_cost    numeric(10,4) DEFAULT 0,
  priority      integer NOT NULL DEFAULT 5,
  last_result   text DEFAULT 'pending',                   -- 'success' | 'failed' | 'pending'
  last_run_at   timestamptz,
  next_run_at   timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedules_user ON schedules(user_id);
CREATE INDEX IF NOT EXISTS idx_schedules_agent ON schedules(agent_id);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY schedules_user_policy ON schedules
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER schedules_updated_at BEFORE UPDATE ON schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
