-- Email triage results
CREATE TABLE IF NOT EXISTS email_triage (
  id          TEXT PRIMARY KEY,
  message_id  TEXT NOT NULL UNIQUE,
  thread_id   TEXT,
  from_addr   TEXT NOT NULL,
  subject     TEXT,
  snippet     TEXT,
  category    TEXT NOT NULL CHECK(category IN
    ('urgent','action_needed','fyi','junk','newsletter','billing','personal')),
  confidence  REAL NOT NULL DEFAULT 0.0,
  auto_action TEXT CHECK(auto_action IN ('none','archive','label','draft_reply')),
  action_taken INTEGER NOT NULL DEFAULT 0,
  draft_id    TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Email drafts created by JARVIS
CREATE TABLE IF NOT EXISTS email_drafts (
  id              TEXT PRIMARY KEY,
  gmail_draft_id  TEXT,
  thread_id       TEXT,
  to_addr         TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body_original   TEXT NOT NULL,
  body_edited     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','review_needed','approved','sent','rejected')),
  approved_at     TEXT,
  sent_at         TEXT,
  approved_by     TEXT,
  edit_feedback   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Proposals
CREATE TABLE IF NOT EXISTS proposals (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  client_name     TEXT,
  client_email    TEXT,
  template        TEXT,
  body_original   TEXT NOT NULL,
  body_edited     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft'
    CHECK(status IN ('draft','review_needed','approved','sent','rejected','revise')),
  approved_at     TEXT,
  sent_at         TEXT,
  approved_by     TEXT,
  edit_feedback   TEXT,
  amount_usd      REAL,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Connector action limits
CREATE TABLE IF NOT EXISTS connector_limits (
  id          TEXT PRIMARY KEY,
  connector   TEXT NOT NULL,
  action      TEXT NOT NULL,
  period      TEXT NOT NULL CHECK(period IN ('per_run','per_day')),
  max_count   INTEGER NOT NULL,
  current     INTEGER NOT NULL DEFAULT 0,
  reset_at    TEXT NOT NULL DEFAULT (datetime('now','+1 day')),
  UNIQUE(connector, action, period)
);

INSERT OR IGNORE INTO connector_limits(id, connector, action, period, max_count) VALUES
  ('gl-scan-run',    'gmail', 'scan',        'per_run', 50),
  ('gl-draft-run',   'gmail', 'create_draft','per_run', 5),
  ('gl-draft-day',   'gmail', 'create_draft','per_day', 20),
  ('gl-label-run',   'gmail', 'label',       'per_run', 20),
  ('gl-label-day',   'gmail', 'label',       'per_day', 100),
  ('gl-archive-run', 'gmail', 'archive',     'per_run', 20),
  ('gl-archive-day', 'gmail', 'archive',     'per_day', 100),
  ('gl-send-day',    'gmail', 'send',        'per_day', 10),
  ('pr-create-day',  'proposals','create',   'per_day', 10),
  ('pr-send-day',    'proposals','send',     'per_day', 5);

-- Circuit breaker state
CREATE TABLE IF NOT EXISTS circuit_breakers (
  id          TEXT PRIMARY KEY,
  connector   TEXT NOT NULL UNIQUE,
  state       TEXT NOT NULL DEFAULT 'closed'
    CHECK(state IN ('closed','open','half_open')),
  error_count INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  opened_at   TEXT,
  closes_at   TEXT
);

INSERT OR IGNORE INTO circuit_breakers(id, connector) VALUES
  ('cb-gmail', 'gmail'),
  ('cb-proposals', 'proposals');

-- Edit feedback (structured diffs)
CREATE TABLE IF NOT EXISTS draft_edit_feedback (
  id                TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  draft_id          TEXT NOT NULL,
  draft_type        TEXT NOT NULL CHECK(draft_type IN ('email','proposal')),
  subject_changed   INTEGER NOT NULL DEFAULT 0,
  tone_changed      INTEGER NOT NULL DEFAULT 0,
  cta_changed       INTEGER NOT NULL DEFAULT 0,
  pricing_changed   INTEGER NOT NULL DEFAULT 0,
  claim_removed     INTEGER NOT NULL DEFAULT 0,
  shortened         INTEGER NOT NULL DEFAULT 0,
  personalized      INTEGER NOT NULL DEFAULT 0,
  original_length   INTEGER,
  edited_length     INTEGER,
  diff_summary      TEXT,
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Quiet hours
CREATE TABLE IF NOT EXISTS quiet_hours (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  start_hour  INTEGER NOT NULL CHECK(start_hour >= 0 AND start_hour <= 23),
  end_hour    INTEGER NOT NULL CHECK(end_hour >= 0 AND end_hour <= 23),
  days        TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
  enabled     INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO quiet_hours(id, start_hour, end_hour, days) VALUES
  ('default', 21, 7, '0,1,2,3,4,5,6');

-- Protected senders (never auto-action)
CREATE TABLE IF NOT EXISTS protected_senders (
  id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email   TEXT NOT NULL UNIQUE,
  reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_triage_category ON email_triage(category);
CREATE INDEX IF NOT EXISTS idx_triage_created ON email_triage(created_at);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
