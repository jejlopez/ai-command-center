-- Proposal presentation system

-- Extend proposals table with presentation data
alter table proposals add column if not exists template_id uuid;
alter table proposals add column if not exists content jsonb default '{}';
alter table proposals add column if not exists company_name text;
alter table proposals add column if not exists client_name text;
alter table proposals add column if not exists client_email text;
alter table proposals add column if not exists lanes jsonb default '[]';
alter table proposals add column if not exists services jsonb default '[]';
alter table proposals add column if not exists terms jsonb default '{}';
alter table proposals add column if not exists executive_summary text;
alter table proposals add column if not exists share_token text unique;
alter table proposals add column if not exists viewed_at timestamptz;
alter table proposals add column if not exists view_count int default 0;
alter table proposals add column if not exists client_response text; -- accepted, changes_requested, declined
alter table proposals add column if not exists client_notes text;
alter table proposals add column if not exists responded_at timestamptz;

-- Proposal analytics
create table if not exists proposal_views (
  id          uuid default gen_random_uuid() primary key,
  proposal_id uuid not null references proposals(id) on delete cascade,
  viewed_at   timestamptz default now(),
  duration_sec int,
  ip_address  text,
  user_agent  text
);

-- No RLS on proposal_views — public access for tracking
-- No RLS on share_token access — clients view without login

alter publication supabase_realtime add table proposal_views;
