-- Feedback capture for learning loops
CREATE TABLE IF NOT EXISTS feedback (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  run_id      TEXT,
  kind        TEXT NOT NULL CHECK(kind IN ('skill_run','ask','brief','general')),
  rating      TEXT NOT NULL CHECK(rating IN ('positive','negative','neutral')),
  reason      TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Router learning history
CREATE TABLE IF NOT EXISTS routing_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_kind    TEXT NOT NULL,
  provider     TEXT NOT NULL,
  model        TEXT NOT NULL,
  success      INTEGER NOT NULL DEFAULT 1,
  feedback_rating TEXT,
  cost_usd     REAL NOT NULL DEFAULT 0,
  duration_ms  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_routing_history_kind ON routing_history(task_kind, model);
CREATE INDEX IF NOT EXISTS idx_feedback_run ON feedback(run_id);
