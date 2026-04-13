-- Pipedrive CRM sync tables

CREATE TABLE IF NOT EXISTS crm_deals (
  id              TEXT PRIMARY KEY,
  pipedrive_id    INTEGER UNIQUE,
  title           TEXT NOT NULL,
  org_name        TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  pipeline        TEXT,
  stage           TEXT,
  status          TEXT DEFAULT 'open' CHECK(status IN ('open','won','lost')),
  value           REAL DEFAULT 0,
  currency        TEXT DEFAULT 'USD',
  created_at      TEXT,
  updated_at      TEXT,
  won_time        TEXT,
  lost_time       TEXT,
  last_activity   TEXT,
  next_activity   TEXT,
  total_activities INTEGER DEFAULT 0,
  engagement      TEXT DEFAULT 'warm' CHECK(engagement IN ('hot','warm','cold','dead')),
  pandadoc_viewed INTEGER DEFAULT 0,
  pandadoc_viewed_at TEXT,
  last_email_from_them TEXT,
  last_email_from_us   TEXT,
  days_in_stage   INTEGER DEFAULT 0,
  operating_model TEXT,
  pricing_model   TEXT,
  notes_summary   TEXT,
  jarvis_score    REAL DEFAULT 0,
  synced_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crm_leads (
  id              TEXT PRIMARY KEY,
  pipedrive_id    INTEGER UNIQUE,
  title           TEXT NOT NULL,
  org_name        TEXT,
  contact_name    TEXT,
  contact_email   TEXT,
  contact_phone   TEXT,
  source          TEXT,
  label           TEXT,
  status          TEXT DEFAULT 'active' CHECK(status IN ('active','archived','converted')),
  created_at      TEXT,
  research        TEXT,
  fit_score       TEXT DEFAULT 'unknown' CHECK(fit_score IN ('hot','warm','cold','unknown')),
  email_drafted   INTEGER DEFAULT 0,
  email_sent      INTEGER DEFAULT 0,
  call_booked     INTEGER DEFAULT 0,
  synced_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crm_activities (
  id              TEXT PRIMARY KEY,
  pipedrive_id    INTEGER,
  deal_id         TEXT,
  type            TEXT,
  subject         TEXT,
  done            INTEGER DEFAULT 0,
  due_date        TEXT,
  done_date       TEXT,
  synced_at       TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS crm_notes (
  id              TEXT PRIMARY KEY,
  pipedrive_id    INTEGER,
  deal_id         TEXT,
  content         TEXT,
  added_at        TEXT,
  synced_at       TEXT DEFAULT (datetime('now'))
);

-- Playbook tables
CREATE TABLE IF NOT EXISTS playbook_pricing (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  deal_id         TEXT,
  component       TEXT NOT NULL,
  rate            REAL NOT NULL,
  unit            TEXT,
  volume          REAL,
  outcome         TEXT CHECK(outcome IN ('won','lost','pending')),
  created_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS playbook_signals (
  id              TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  signal_type     TEXT NOT NULL,
  description     TEXT NOT NULL,
  correlation     REAL,
  sample_size     INTEGER DEFAULT 0,
  last_updated    TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_deals_pipeline ON crm_deals(pipeline, status);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON crm_deals(stage);
CREATE INDEX IF NOT EXISTS idx_leads_status ON crm_leads(status);
