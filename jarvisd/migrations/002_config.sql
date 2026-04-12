-- JARVIS OS — config table v2
CREATE TABLE IF NOT EXISTS jarvis_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (2, datetime('now'));
