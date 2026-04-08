-- ============================================================
-- Migration 001: pending_reviews + approval_audit
-- Scope: Review Room vertical slice
-- ============================================================

-- ── Enums ────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE review_urgency AS ENUM ('critical', 'high', 'normal');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_output_type AS ENUM ('code', 'report', 'error', 'message', 'data');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE review_status AS ENUM (
    'awaiting_approval',
    'needs_intervention',
    'approved',
    'rejected',
    'revision_requested'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE audit_decision AS ENUM ('approved', 'rejected', 'revision_requested');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── pending_reviews ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS pending_reviews (
  id            text PRIMARY KEY,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_id      text,                                   -- FK to agents table added in future migration
  agent_name    text NOT NULL,
  urgency       review_urgency NOT NULL DEFAULT 'normal',
  title         text NOT NULL,
  output_type   review_output_type NOT NULL,
  status        review_status NOT NULL DEFAULT 'awaiting_approval',
  summary       text,
  payload       text,
  waiting_since timestamptz NOT NULL DEFAULT now(),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_reviews_user   ON pending_reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_pending_reviews_status ON pending_reviews(status);

-- ── approval_audit (append-only) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS approval_audit (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  review_id   text NOT NULL REFERENCES pending_reviews(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  decision    audit_decision NOT NULL,
  feedback    text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_audit_review ON approval_audit(review_id);
CREATE INDEX IF NOT EXISTS idx_approval_audit_user   ON approval_audit(user_id);

-- ── Row Level Security ───────────────────────────────────────────

ALTER TABLE pending_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_audit  ENABLE ROW LEVEL SECURITY;

-- Users see/modify only their own rows
DO $$ BEGIN
  CREATE POLICY pending_reviews_user_policy ON pending_reviews
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY approval_audit_user_policy ON approval_audit
    FOR ALL
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
