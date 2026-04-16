-- Objection tracking for objection_coach skill

CREATE TABLE IF NOT EXISTS objection_log (
  id TEXT PRIMARY KEY,
  deal_id TEXT,
  objection TEXT NOT NULL,
  response TEXT,
  outcome TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_objection_deal ON objection_log(deal_id);
