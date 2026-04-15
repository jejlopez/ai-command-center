-- Jarvis Sign — e-signature audit trail and document integrity

-- Detailed audit events (not just view count)
create table if not exists sign_audit_events (
  id          uuid default gen_random_uuid() primary key,
  proposal_id uuid not null references proposals(id) on delete cascade,
  event_type  text not null,  -- created, sent, viewed, consent_checked, review_checked, signed, downloaded, voided, reminder_sent, expired
  actor       text,           -- 'sender', 'signer', 'system'
  ip_address  text,
  user_agent  text,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);
create index if not exists idx_sign_audit_proposal on sign_audit_events(proposal_id, created_at);

-- Add document integrity fields to proposals
alter table proposals add column if not exists content_hash text;          -- SHA-256 of proposal content at send time
alter table proposals add column if not exists locked_at timestamptz;      -- when document was locked for signing
alter table proposals add column if not exists voided_at timestamptz;      -- if voided
alter table proposals add column if not exists voided_reason text;
alter table proposals add column if not exists reminder_count int default 0;
alter table proposals add column if not exists last_reminder_at timestamptz;
alter table proposals add column if not exists expires_at timestamptz;     -- proposal expiration
alter table proposals add column if not exists executed_at timestamptz;    -- when fully executed
alter table proposals add column if not exists signer_email_verified boolean default false;
