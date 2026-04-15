-- CRM Foundation — 13 new tables + deals enhancement

-- ── Contacts ─────────────────────────────────────────────────────────────────
create table if not exists contacts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  email       text,
  phone       text,
  title       text,
  company     text,
  linkedin_url text,
  is_decision_maker boolean default false,
  notes       text,
  pipedrive_id int,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table contacts enable row level security;
create policy "contacts_owner" on contacts for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_contacts_user on contacts(user_id);
create index if not exists idx_contacts_email on contacts(email);

-- ── Leads ────────────────────────────────────────────────────────────────────
create table if not exists leads (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  company     text not null,
  contact_id  uuid references contacts(id) on delete set null,
  source      text,
  status      text not null default 'new',
  quality     text,
  attention   text,
  strike_count int not null default 0,
  lead_score  int,
  whale_score int,
  next_best_action jsonb,
  research_packet jsonb,
  qualification jsonb,
  pipedrive_id int,
  deal_id     uuid,
  converted_at timestamptz,
  notes       text,
  tags        text[],
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
alter table leads enable row level security;
create policy "leads_owner" on leads for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_leads_user on leads(user_id);
create index if not exists idx_leads_status on leads(status);
create index if not exists idx_leads_attention on leads(attention);
create index if not exists idx_leads_pipedrive on leads(pipedrive_id);
alter publication supabase_realtime add table leads;

-- ── Activities ───────────────────────────────────────────────────────────────
create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id     uuid references leads(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete set null,
  type        text not null,
  subject     text,
  body        text,
  metadata    jsonb,
  source      text default 'manual',
  occurred_at timestamptz default now(),
  created_at  timestamptz default now()
);
alter table activities enable row level security;
create policy "activities_owner" on activities for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_activities_user on activities(user_id);
create index if not exists idx_activities_lead on activities(lead_id);
create index if not exists idx_activities_deal on activities(deal_id);
create index if not exists idx_activities_type on activities(type);
alter publication supabase_realtime add table activities;

-- ── Sequences ────────────────────────────────────────────────────────────────
create table if not exists sequences (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id     uuid references leads(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  type        text not null,
  status      text not null default 'active',
  current_step int not null default 0,
  started_at  timestamptz default now(),
  completed_at timestamptz,
  next_fire_at timestamptz
);
alter table sequences enable row level security;
create policy "sequences_owner" on sequences for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_sequences_user on sequences(user_id);
create index if not exists idx_sequences_lead on sequences(lead_id);
create index if not exists idx_sequences_deal on sequences(deal_id);
create index if not exists idx_sequences_status on sequences(status);

create table if not exists sequence_steps (
  id          uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_number int not null,
  action      text not null,
  delay_days  int not null default 0,
  template_id uuid,
  status      text not null default 'pending',
  completed_at timestamptz,
  result      jsonb,
  behavioral_override jsonb
);
create index if not exists idx_seqsteps_sequence on sequence_steps(sequence_id);

-- ── Approvals ────────────────────────────────────────────────────────────────
create table if not exists approvals (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id     uuid references leads(id),
  deal_id     uuid references deals(id),
  type        text not null,
  status      text not null default 'pending',
  draft_content jsonb,
  final_content jsonb,
  user_edits  jsonb,
  user_comment text,
  source_agent text,
  created_at  timestamptz default now(),
  decided_at  timestamptz
);
alter table approvals enable row level security;
create policy "approvals_owner" on approvals for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_approvals_user on approvals(user_id);
create index if not exists idx_approvals_status on approvals(status);

-- ── Learning Events ──────────────────────────────────────────────────────────
create table if not exists learning_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  approval_id uuid references approvals(id),
  lead_id     uuid references leads(id),
  deal_id     uuid references deals(id),
  event_type  text not null,
  ai_draft    jsonb,
  final_version jsonb,
  diff_summary jsonb,
  outcome     jsonb,
  created_at  timestamptz default now()
);
alter table learning_events enable row level security;
create policy "learning_owner" on learning_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Research Packets ─────────────────────────────────────────────────────────
create table if not exists research_packets (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id     uuid not null references leads(id) on delete cascade,
  version     int not null default 1,
  company_overview text,
  what_they_do text,
  ecommerce_signals text,
  estimated_volume text,
  revenue_clues text,
  tech_stack  text,
  linkedin_info text,
  pain_points text,
  buying_triggers text,
  qualification_notes text,
  recommended_angle text,
  raw_sources jsonb,
  generated_by text,
  created_at  timestamptz default now()
);
alter table research_packets enable row level security;
create policy "research_owner" on research_packets for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_research_lead on research_packets(lead_id);

-- ── Tracking Events ──────────────────────────────────────────────────────────
create table if not exists tracking_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  lead_id     uuid references leads(id),
  deal_id     uuid references deals(id),
  contact_id  uuid references contacts(id),
  event_type  text not null,
  source      text,
  metadata    jsonb,
  occurred_at timestamptz default now()
);
alter table tracking_events enable row level security;
create policy "tracking_owner" on tracking_events for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_tracking_lead on tracking_events(lead_id);
create index if not exists idx_tracking_deal on tracking_events(deal_id);

-- ── Audit Log ────────────────────────────────────────────────────────────────
create table if not exists audit_log (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  actor       text not null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  before_state jsonb,
  after_state jsonb,
  reason      text,
  prev_hash   text,
  created_at  timestamptz default now()
);
alter table audit_log enable row level security;
create policy "audit_owner" on audit_log for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_audit_user on audit_log(user_id);
create index if not exists idx_audit_entity on audit_log(entity_type, entity_id);

-- ── Objections ───────────────────────────────────────────────────────────────
create table if not exists objections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid not null references deals(id) on delete cascade,
  objection   text not null,
  response    text,
  status      text not null default 'open',
  raised_at   timestamptz default now(),
  resolved_at timestamptz
);
alter table objections enable row level security;
create policy "objections_owner" on objections for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_objections_deal on objections(deal_id);

-- ── Discovery Requirements ───────────────────────────────────────────────────
create table if not exists discovery_requirements (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid not null references deals(id) on delete cascade,
  category    text not null,
  question    text not null,
  answer      text,
  status      text not null default 'unknown',
  asked_at    timestamptz,
  answered_at timestamptz
);
alter table discovery_requirements enable row level security;
create policy "discovery_owner" on discovery_requirements for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_discovery_deal on discovery_requirements(deal_id);

-- ── Win/Loss Reviews ─────────────────────────────────────────────────────────
create table if not exists win_loss_reviews (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid not null references deals(id) on delete cascade,
  outcome     text not null,
  primary_reason text,
  what_worked text,
  what_didnt  text,
  lost_to     text,
  would_change text,
  created_at  timestamptz default now()
);
alter table win_loss_reviews enable row level security;
create policy "winloss_owner" on win_loss_reviews for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ── Enhance Deals Table ──────────────────────────────────────────────────────
alter table deals add column if not exists quality text;
alter table deals add column if not exists attention text;
alter table deals add column if not exists strike_count int not null default 0;
alter table deals add column if not exists health_score int;
alter table deals add column if not exists whale_score int;
alter table deals add column if not exists next_best_action jsonb;
alter table deals add column if not exists volumes jsonb;
alter table deals add column if not exists services_needed text[];
alter table deals add column if not exists decision_maker text;
alter table deals add column if not exists timeline text;
alter table deals add column if not exists current_provider text;
alter table deals add column if not exists switch_reason text;
alter table deals add column if not exists converted_from_lead_id uuid;
