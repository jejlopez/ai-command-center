-- M6 polish: edit-as-feedback, snooze tracking, recommendation timing

-- Track edits to JARVIS outputs as implicit feedback
CREATE TABLE IF NOT EXISTS output_edits (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  output_id   TEXT NOT NULL,
  original    TEXT NOT NULL,
  edited      TEXT NOT NULL,
  diff_size   INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Track snooze/dismiss patterns on reminders and suggestions
CREATE TABLE IF NOT EXISTS snooze_events (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  item_type   TEXT NOT NULL CHECK(item_type IN ('approval','reminder','suggestion','skill_run')),
  item_id     TEXT NOT NULL,
  action      TEXT NOT NULL CHECK(action IN ('snooze','dismiss','act')),
  delay_ms    INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Track when users actually act on recommendations (for timing optimization)
CREATE TABLE IF NOT EXISTS action_timing (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  event_type  TEXT NOT NULL,
  suggested_at TEXT NOT NULL,
  acted_at    TEXT,
  delay_ms    INTEGER,
  day_of_week INTEGER,
  hour_of_day INTEGER,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_snooze_type ON snooze_events(item_type);
CREATE INDEX IF NOT EXISTS idx_timing_event ON action_timing(event_type);
CREATE INDEX IF NOT EXISTS idx_timing_hour ON action_timing(hour_of_day);
