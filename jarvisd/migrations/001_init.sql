-- JARVIS OS — core schema v1
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

-- Append-only, hash-chained audit log. Never UPDATE or DELETE rows.
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  ts           TEXT NOT NULL,
  actor        TEXT NOT NULL,         -- 'system' | 'user' | 'skill:<name>'
  action       TEXT NOT NULL,         -- e.g. 'vault.unlock', 'ask', 'memory.write'
  subject      TEXT,                  -- optional target (file, id, key)
  reason       TEXT,
  metadata     TEXT,                  -- JSON
  prev_hash    TEXT NOT NULL,
  hash         TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON audit_log(ts);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_log(action);

-- Model routing + cost accounting.
CREATE TABLE IF NOT EXISTS cost_events (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,
  model      TEXT NOT NULL,
  provider   TEXT NOT NULL,
  task_kind  TEXT,
  tokens_in  INTEGER NOT NULL,
  tokens_out INTEGER NOT NULL,
  cost_usd   REAL NOT NULL,
  skill      TEXT,
  run_id     TEXT
);
CREATE INDEX IF NOT EXISTS idx_cost_ts ON cost_events(ts);

-- Memory graph: nodes + typed edges + MD file pointers.
CREATE TABLE IF NOT EXISTS memory_nodes (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,          -- person | project | task | fact | event | pref
  label      TEXT NOT NULL,
  body       TEXT,                   -- short summary
  file_path  TEXT,                   -- optional MD vault path
  trust      REAL NOT NULL DEFAULT 0.5,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_nodes_kind ON memory_nodes(kind);
CREATE INDEX IF NOT EXISTS idx_nodes_label ON memory_nodes(label);

CREATE TABLE IF NOT EXISTS memory_edges (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  src_id     TEXT NOT NULL,
  dst_id     TEXT NOT NULL,
  relation   TEXT NOT NULL,
  ts         TEXT NOT NULL,          -- temporal: when the relation held
  weight     REAL NOT NULL DEFAULT 1.0,
  source     TEXT,
  FOREIGN KEY(src_id) REFERENCES memory_nodes(id),
  FOREIGN KEY(dst_id) REFERENCES memory_nodes(id)
);
CREATE INDEX IF NOT EXISTS idx_edges_src ON memory_edges(src_id);
CREATE INDEX IF NOT EXISTS idx_edges_dst ON memory_edges(dst_id);
CREATE INDEX IF NOT EXISTS idx_edges_rel ON memory_edges(relation);

CREATE TABLE IF NOT EXISTS memory_access_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  ts         TEXT NOT NULL,
  op         TEXT NOT NULL,          -- recall | remember | forget
  node_id    TEXT,
  actor      TEXT NOT NULL,
  reason     TEXT
);

-- Approvals queue.
CREATE TABLE IF NOT EXISTS approvals (
  id           TEXT PRIMARY KEY,
  title        TEXT NOT NULL,
  reason       TEXT NOT NULL,
  risk_level   TEXT NOT NULL,
  skill        TEXT NOT NULL,
  payload      TEXT NOT NULL,        -- JSON
  requested_at TEXT NOT NULL,
  decided_at   TEXT,
  decision     TEXT,                 -- approve | deny | null
  decision_reason TEXT
);

-- Jarvis output surface (polished results).
CREATE TABLE IF NOT EXISTS jarvis_outputs (
  id         TEXT PRIMARY KEY,
  kind       TEXT NOT NULL,          -- brief | draft | plan | research | summary
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,          -- JSON or markdown
  created_at TEXT NOT NULL,
  skill      TEXT
);
CREATE INDEX IF NOT EXISTS idx_outputs_kind ON jarvis_outputs(kind);

-- Morning brief history (latest is current).
CREATE TABLE IF NOT EXISTS daily_briefs (
  id         TEXT PRIMARY KEY,
  generated_at TEXT NOT NULL,
  body       TEXT NOT NULL           -- JSON (MorningBrief)
);

INSERT OR IGNORE INTO schema_version(version, applied_at)
VALUES (1, datetime('now'));
