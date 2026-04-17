-- Learning system tables

CREATE TABLE IF NOT EXISTS jarvis_learning (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,           -- historical_style, email_edit, deal_judgment, approval_pattern, weekly_analysis
  data TEXT NOT NULL,           -- JSON payload
  deal_id TEXT,
  contact TEXT,
  confidence REAL DEFAULT 0.5,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_learning_type ON jarvis_learning(type);
CREATE INDEX IF NOT EXISTS idx_learning_deal ON jarvis_learning(deal_id);

CREATE TABLE IF NOT EXISTS jarvis_style_profile (
  id TEXT PRIMARY KEY DEFAULT 'current',
  email_count INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  profile TEXT NOT NULL,        -- JSON style profile
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS jarvis_learning_stats (
  id TEXT PRIMARY KEY DEFAULT 'current',
  total_events INTEGER DEFAULT 0,
  events_today INTEGER DEFAULT 0,
  today_date TEXT,
  accuracy_pct REAL DEFAULT 0,
  last_analysis TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);
