-- ============================================================
-- Managed Ops runtime links: tasks, logs, and reviews -> sessions
-- ============================================================

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES agent_sessions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES agent_templates(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_session_id ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_template_id ON tasks(template_id);

ALTER TABLE activity_log
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES agent_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_activity_log_session_id ON activity_log(session_id);

ALTER TABLE pending_reviews
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES agent_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pending_reviews_session_id ON pending_reviews(session_id);
