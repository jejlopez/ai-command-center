-- Skill runs — persistent record of every skill execution.
-- One row per run; populated by the workflow engine in lib/workflow.ts.

CREATE TABLE IF NOT EXISTS skill_runs (
  id            TEXT PRIMARY KEY,
  skill         TEXT NOT NULL,
  status        TEXT NOT NULL,
  triggered_by  TEXT NOT NULL,
  started_at    TEXT NOT NULL,
  completed_at  TEXT,
  duration_ms   INTEGER,
  inputs        TEXT,
  output        TEXT,
  error         TEXT,
  cost_usd      REAL,
  tokens_in     INTEGER,
  tokens_out    INTEGER
);

CREATE INDEX IF NOT EXISTS idx_skill_runs_skill   ON skill_runs(skill);
CREATE INDEX IF NOT EXISTS idx_skill_runs_started ON skill_runs(started_at);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (6, datetime('now'));
