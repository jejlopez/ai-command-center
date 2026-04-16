-- Value estimate feedback + calibration tables

CREATE TABLE IF NOT EXISTS value_estimate_feedback (
  id TEXT PRIMARY KEY,
  deal_id TEXT,
  company TEXT NOT NULL,
  original_estimate REAL,
  corrected_value REAL,
  math TEXT,           -- JSON array of line items
  data_sources TEXT,   -- JSON array of source names
  reason TEXT NOT NULL,
  decision TEXT NOT NULL DEFAULT 'rejected',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_vef_decision ON value_estimate_feedback(decision);

CREATE TABLE IF NOT EXISTS value_estimate_calibration (
  id TEXT PRIMARY KEY,
  denial_count INTEGER NOT NULL,
  calibration_data TEXT NOT NULL, -- JSON with updated pricing benchmarks
  created_at TEXT DEFAULT (datetime('now'))
);
