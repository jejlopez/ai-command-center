-- Episodic memory — chronological snapshots of what happened.
-- Unlike memory_nodes (facts / entities) this is the event log: briefs
-- generated, approvals decided, skills run, etc.

CREATE TABLE IF NOT EXISTS episodic_snapshots (
  id          TEXT PRIMARY KEY,
  ts          TEXT NOT NULL,
  kind        TEXT NOT NULL,       -- brief | approval | skill_run | remember | custom
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,       -- JSON blob
  actor       TEXT
);

CREATE INDEX IF NOT EXISTS idx_episodic_ts   ON episodic_snapshots(ts);
CREATE INDEX IF NOT EXISTS idx_episodic_kind ON episodic_snapshots(kind);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (5, datetime('now'));
