-- Per-tool-call attribution for the agentic loop.
-- Each row represents one tool_use dispatch inside runAgenticTurn().
-- cost_usd tracks the LLM cost the tool itself incurred (e.g. run_skill
-- wrapping another LLM call). Simple read-only tools record 0.

CREATE TABLE IF NOT EXISTS tool_calls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ts TEXT NOT NULL,
  run_id TEXT NOT NULL,
  iteration INTEGER NOT NULL,
  tool_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  is_error INTEGER NOT NULL DEFAULT 0,
  queued INTEGER NOT NULL DEFAULT 0,
  approval_id TEXT,
  cost_usd REAL NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_tool_calls_ts ON tool_calls(ts);
CREATE INDEX IF NOT EXISTS idx_tool_calls_run ON tool_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_tool ON tool_calls(tool_name);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (16, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'));
