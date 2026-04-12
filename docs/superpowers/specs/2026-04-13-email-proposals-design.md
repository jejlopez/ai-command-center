# JARVIS Email + Proposals — Architecture & Security Design

**Date:** 2026-04-13
**Status:** Pending approval

---

## 1. Architecture Plan

```
┌─────────────────────────────────────────────────────┐
│                      USER                            │
│  Reviews drafts → Edits → Approves/Rejects           │
└──────────────┬──────────────────────┬────────────────┘
               │ UI                   │ Notifications
┌──────────────▼──────────────────────▼────────────────┐
│                   JARVIS UI                           │
│  Inbox Triage View │ Draft Review │ Proposal Editor   │
└──────────────┬──────────────────────┬────────────────┘
               │ REST + WebSocket     │
┌──────────────▼──────────────────────▼────────────────┐
│                  JARVIS DAEMON                        │
│                                                       │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Gmail       │  │ Email Triage │  │ Proposal     │ │
│  │ Connector   │  │ Skill        │  │ Generator    │ │
│  │ (OAuth)     │  │ (classify,   │  │ Skill        │ │
│  │             │  │  draft)      │  │              │ │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘ │
│         │                │                  │         │
│  ┌──────▼────────────────▼──────────────────▼───────┐ │
│  │           APPROVAL GATEWAY                        │ │
│  │  Every outbound action MUST pass through here.    │ │
│  │  No bypass. Hash-chained audit log.               │ │
│  │                                                   │ │
│  │  Actions:                                         │ │
│  │    send_email    → REQUIRES approval              │ │
│  │    create_draft  → auto (within limits)           │ │
│  │    label/archive → auto (within limits)           │ │
│  │    send_proposal → REQUIRES approval              │ │
│  │    delete        → BLOCKED (never)                │ │
│  │    forward       → BLOCKED (never)                │ │
│  └───────────────────────┬───────────────────────────┘ │
│                          │                             │
│  ┌───────────────────────▼───────────────────────────┐ │
│  │           LIMITS ENGINE                            │ │
│  │  Rate limits, daily caps, circuit breakers,        │ │
│  │  quiet hours, VIP protection, budget caps          │ │
│  └───────────────────────┬───────────────────────────┘ │
│                          │                             │
│  ┌───────────────────────▼───────────────────────────┐ │
│  │           EDIT FEEDBACK CAPTURE                    │ │
│  │  Structured diff: subject/tone/CTA/pricing/length │ │
│  │  Feeds back into draft quality over time           │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

**Key principles:**
- Draft-first: JARVIS creates, you review, you approve, then it acts.
- Zero-trust: every outbound action goes through Approval Gateway.
- Delete/forward are BLOCKED at the code level, not configurable.
- Send always requires explicit approval. No override without code change.
- All actions logged to hash-chained audit trail.

---

## 2. Security Model

### Authentication layers
1. **OAuth tokens** — stored in vault (AES-256-GCM), never in env vars or logs
2. **Daemon auth** — localhost-only binding (127.0.0.1:8787), CORS restricted
3. **Rate limiting** — per-endpoint, per-minute, with circuit breaker
4. **Approval gateway** — cryptographic action tokens, single-use, time-limited

### Threat model

| Threat | Mitigation |
|--------|-----------|
| Someone hits the API directly | Localhost-only, rate limiter, auth required |
| Rogue skill sends email | Approval gateway blocks all send without approval token |
| OAuth token leaked | Tokens in vault, never logged, minimal scopes |
| JARVIS drafts something harmful | You review every draft before send |
| Runaway automation (loop) | Circuit breaker: >5 errors in 5min = auto-disable |
| Budget burn | Daily AI cost cap + daily connector action cap |
| Approval bypass attempt | Audit logged, auto-lockout, panic button fires |

### Blocked actions (code-level, not config)
- `DELETE` any email — never
- `FORWARD` any email — never
- `SEND` without approval token — never
- Actions on starred/VIP threads — never (unless VIP override approval)

### Kill switch
- `POST /panic` — immediately:
  - Revokes all pending approvals
  - Disables all connector actions
  - Locks the vault
  - Logs the panic event
  - Emits WebSocket `panic` event to UI

---

## 3. Gmail OAuth Scopes

**Minimum scopes required per phase:**

| Phase | Scope | Why |
|-------|-------|-----|
| A (read) | `gmail.readonly` | Read messages + labels |
| B (draft) | `gmail.readonly` + `gmail.compose` | Create/update drafts |
| C (label) | `gmail.readonly` + `gmail.compose` + `gmail.modify` | Apply labels, archive |
| D (send) | `gmail.readonly` + `gmail.compose` + `gmail.modify` + `gmail.send` | Send on behalf |

**Never request:**
- `gmail.full` — too broad
- `gmail.settings` — not needed
- Any scope with `delete`

**Scope upgrade flow:**
Each phase requires re-authorization with the new scope. The user explicitly clicks "Upgrade to Phase B" in Settings → Connectors. No silent scope expansion.

---

## 4. DB Schema Changes

### Migration 010: Email + Proposals

```sql
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

-- Connector action limits (runtime enforcement)
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

-- Insert default limits
INSERT OR IGNORE INTO connector_limits(id, connector, action, period, max_count) VALUES
  ('gl-scan-run',    'gmail', 'scan',       'per_run', 50),
  ('gl-draft-run',   'gmail', 'create_draft','per_run', 5),
  ('gl-draft-day',   'gmail', 'create_draft','per_day', 20),
  ('gl-label-run',   'gmail', 'label',      'per_run', 20),
  ('gl-label-day',   'gmail', 'label',      'per_day', 100),
  ('gl-archive-run', 'gmail', 'archive',    'per_run', 20),
  ('gl-archive-day', 'gmail', 'archive',    'per_day', 100),
  ('gl-send-day',    'gmail', 'send',       'per_day', 10),
  ('pr-create-day',  'proposals','create',  'per_day', 10),
  ('pr-send-day',    'proposals','send',    'per_day', 5);

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

-- Edit feedback (structured diffs from user edits)
CREATE TABLE IF NOT EXISTS draft_edit_feedback (
  id            TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  draft_id      TEXT NOT NULL,
  draft_type    TEXT NOT NULL CHECK(draft_type IN ('email','proposal')),
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
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Quiet hours / no-send windows
CREATE TABLE IF NOT EXISTS quiet_hours (
  id          TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  start_hour  INTEGER NOT NULL CHECK(start_hour >= 0 AND start_hour <= 23),
  end_hour    INTEGER NOT NULL CHECK(end_hour >= 0 AND end_hour <= 23),
  days        TEXT NOT NULL DEFAULT '0,1,2,3,4,5,6',
  enabled     INTEGER NOT NULL DEFAULT 1
);

INSERT OR IGNORE INTO quiet_hours(id, start_hour, end_hour, days) VALUES
  ('default', 21, 7, '0,1,2,3,4,5,6');

-- VIP / protected senders (never auto-action)
CREATE TABLE IF NOT EXISTS protected_senders (
  id      TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email   TEXT NOT NULL UNIQUE,
  reason  TEXT
);

CREATE INDEX IF NOT EXISTS idx_triage_category ON email_triage(category);
CREATE INDEX IF NOT EXISTS idx_triage_created ON email_triage(created_at);
CREATE INDEX IF NOT EXISTS idx_drafts_status ON email_drafts(status);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
```

---

## 5. Policy / Limits Model

### Hard limits (code-enforced, not configurable)

| Action | Limit | Enforcement |
|--------|-------|-------------|
| Send email | REQUIRES approval token | Approval gateway |
| Send proposal | REQUIRES approval token | Approval gateway |
| Delete email | BLOCKED | Not implemented in code |
| Forward email | BLOCKED | Not implemented in code |
| Actions on starred | BLOCKED | Checked before action |
| Actions on protected senders | BLOCKED | Checked against table |

### Configurable limits (stored in connector_limits table)

| Action | Per Run | Per Day |
|--------|---------|---------|
| Scan inbox | 50 | unlimited |
| Create draft | 5 | 20 |
| Label | 20 | 100 |
| Archive | 20 | 100 |
| Send (with approval) | n/a | 10 |
| Create proposal | n/a | 10 |
| Send proposal (with approval) | n/a | 5 |

### Circuit breaker
- Threshold: 5 errors in 5 minutes → OPEN (all actions blocked)
- Half-open after 15 minutes → allows 1 test request
- Closes on success, re-opens on failure
- Manual reset via `POST /circuit-breaker/reset`

### Quiet hours
- Default: 9pm - 7am — no sends, no archive, no label
- Configurable per day-of-week
- Override: approval with reason ("urgent")

### AI budget
- Existing daily budget cap applies (config.dailyBudgetUsd)
- Email triage uses Haiku ($0.001/run) — ~$0.10/day at 100 emails
- Draft generation uses Sonnet ($0.01/draft) — ~$0.20/day at 20 drafts

---

## 6. Rollout Phases

### Phase A: Read-Only (Week 1)

**Enabled:**
- Gmail OAuth with `gmail.readonly` scope
- Email triage skill: reads inbox, categorizes, stores in email_triage table
- Triage results visible in UI (new Inbox view)
- No actions taken on any email

**Blocked:**
- Draft creation
- Labeling
- Archiving
- Sending
- Proposals

**Test plan:**
- Run triage on 20 emails
- Verify categorization accuracy
- Verify no Gmail API write calls in audit log
- Verify protected senders are never categorized as "junk"

### Phase B: Draft-Only (Week 2)

**Enabled:**
- Everything from Phase A
- Gmail OAuth upgraded to `gmail.readonly` + `gmail.compose`
- JARVIS creates drafts in Gmail for "action_needed" emails
- Drafts appear in Gmail drafts folder AND in JARVIS UI
- You review/edit in JARVIS UI or Gmail
- Edits captured as structured feedback

**Blocked:**
- Sending (drafts sit until you manually send)
- Labeling
- Archiving
- Proposals

**Test plan:**
- Trigger draft for 3 emails
- Verify drafts appear in Gmail
- Edit a draft, verify feedback captured
- Verify daily limit (20) works
- Verify circuit breaker fires on API errors

### Phase C: Draft + Approval Send (Week 3)

**Enabled:**
- Everything from Phase B
- Gmail scope upgraded to include `gmail.send`
- "Approve & Send" button in JARVIS UI
- Sends ONLY after you click approve
- Approval token is single-use, time-limited (5 min)

**Blocked:**
- Auto-send (will never be auto)
- Labeling
- Archiving
- Proposals

**Test plan:**
- Create draft → review → approve → verify sent
- Create draft → let approval token expire → verify cannot send
- Attempt to send without approval → verify blocked in audit log
- Hit daily send limit (10) → verify blocked

### Phase D: Safe Label/Archive (Week 4)

**Enabled:**
- Everything from Phase C
- Gmail scope upgraded to include `gmail.modify`
- JARVIS can label "junk" emails and archive them
- Only for categories with >90% confidence
- Never on starred, protected, or VIP threads
- Runs within per-run and per-day limits

**Blocked:**
- Auto-send (always requires approval)
- Delete
- Forward
- Actions on starred/protected

**Test plan:**
- Let triage run, verify only high-confidence junk gets archived
- Star an email, verify JARVIS skips it
- Add sender to protected list, verify skipped
- Hit archive limit, verify stops

### Phase E: Proposals (Week 5)

**Enabled:**
- Proposal generator skill
- Proposal state machine: draft → review_needed → approved → sent
- Review/edit UI
- Send only after approval
- Edit feedback captured

**Blocked:**
- Auto-finalize
- Auto-send

---

## 7. Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| JARVIS sends wrong email | Low (approval required) | High | Draft-first, approval gate, quiet hours |
| OAuth token compromised | Low (vault encrypted) | High | Minimal scopes, token rotation, panic button |
| Runaway triage loop | Medium | Medium | Circuit breaker, per-run limits, error rate monitor |
| Wrong email categorized as junk | Medium | Medium | >90% confidence threshold, protected senders, VIP list |
| Daily limit burn | Low | Low | Hard caps in DB, reset at midnight |
| Proposal sent to wrong person | Low (approval required) | High | Approval gate, recipient shown in approval dialog |
| API abuse from network | Very low (localhost only) | Medium | Rate limiter, localhost binding, CORS |
| User edits feedback gaming | Very low | Low | Structured diff categories, audit trail |

---

## Implementation Order

After approval, I'll implement in this commit sequence:

1. Migration 010 (schema)
2. Gmail connector upgrade (OAuth scopes, draft/label/archive/send methods)
3. Limits engine (rate limits, circuit breaker, quiet hours)
4. Approval gateway upgrade (action tokens for send)
5. Email triage skill (Phase A — read + classify)
6. Draft creation skill (Phase B — create drafts)
7. Send-with-approval flow (Phase C)
8. Label/archive automation (Phase D)
9. Proposal generator + state machine (Phase E)
10. UI: Inbox triage view, draft review, proposal editor
11. Edit feedback capture (structured diff)

Each commit is independently testable. Each phase can be paused.

---

*This spec must be approved before any code is written.*
