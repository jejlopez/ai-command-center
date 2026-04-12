-- JARVIS OS — focus blocks v3
CREATE TABLE IF NOT EXISTS focus_blocks (
  id         TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  start_ts   TEXT NOT NULL,
  end_ts     TEXT NOT NULL,
  notes      TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_focus_blocks_start_ts ON focus_blocks(start_ts);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (3, datetime('now'));
