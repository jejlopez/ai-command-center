-- Operations Hub — proposals, documents, communications, templates, competitors, projects, ship_log, onboarding_checklists

-- ── Proposals ─────────────────────────────────────────────────────────────────
create table if not exists proposals (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid references deals(id) on delete set null,
  name        text not null,
  version     int not null default 1,
  status      text not null default 'draft',  -- draft, sent, viewed, accepted, rejected, expired
  pricing     jsonb not null default '{}',     -- { rate_per_mile, fuel_surcharge_pct, accessorials: [{name, amount}], total }
  valid_until date,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table proposals enable row level security;
create policy "proposals_owner" on proposals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_proposals_user on proposals(user_id);
create index if not exists idx_proposals_deal on proposals(deal_id);
alter publication supabase_realtime add table proposals;

-- ── Documents ─────────────────────────────────────────────────────────────────
create table if not exists documents (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid references deals(id) on delete set null,
  contact_id  uuid references contacts(id) on delete set null,
  name        text not null,
  type        text not null default 'other',  -- proposal, contract, sow, invoice, rate_sheet, other
  file_url    text,
  file_size   int,
  status      text default 'draft',            -- draft, sent, signed, expired
  created_at  timestamptz default now()
);

alter table documents enable row level security;
create policy "documents_owner" on documents
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_documents_user on documents(user_id);
create index if not exists idx_documents_deal on documents(deal_id);
create index if not exists idx_documents_contact on documents(contact_id);
alter publication supabase_realtime add table documents;

-- ── Communications ────────────────────────────────────────────────────────────
create table if not exists communications (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contact_id  uuid references contacts(id) on delete set null,
  deal_id     uuid references deals(id) on delete set null,
  type        text not null default 'note',    -- call, email, meeting, note
  subject     text,
  body        text not null,
  occurred_at timestamptz default now(),
  created_at  timestamptz default now()
);

alter table communications enable row level security;
create policy "communications_owner" on communications
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_communications_user on communications(user_id);
create index if not exists idx_communications_contact on communications(contact_id);
create index if not exists idx_communications_deal on communications(deal_id);
alter publication supabase_realtime add table communications;

-- ── Templates ─────────────────────────────────────────────────────────────────
create table if not exists templates (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  type        text not null default 'proposal', -- proposal, email, follow_up
  content     text not null,
  variables   text[],
  times_used  int default 0,
  win_rate    real,
  created_at  timestamptz default now()
);

alter table templates enable row level security;
create policy "templates_owner" on templates
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_templates_user on templates(user_id);
alter publication supabase_realtime add table templates;

-- ── Competitors ───────────────────────────────────────────────────────────────
create table if not exists competitors (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  notes       text,
  deals_lost  int default 0,
  created_at  timestamptz default now()
);

alter table competitors enable row level security;
create policy "competitors_owner" on competitors
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_competitors_user on competitors(user_id);
alter publication supabase_realtime add table competitors;

-- ── Projects ──────────────────────────────────────────────────────────────────
create table if not exists projects (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null,
  status      text not null default 'active',  -- active, paused, completed
  repo_url    text,
  notes       text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table projects enable row level security;
create policy "projects_owner" on projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_projects_user on projects(user_id);
alter publication supabase_realtime add table projects;

-- ── Ship Log ──────────────────────────────────────────────────────────────────
create table if not exists ship_log (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  project_id  uuid references projects(id) on delete set null,
  title       text not null,
  description text,
  type        text default 'feature',          -- feature, fix, refactor, deploy
  shipped_at  timestamptz default now()
);

alter table ship_log enable row level security;
create policy "ship_log_owner" on ship_log
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_ship_log_user on ship_log(user_id);
create index if not exists idx_ship_log_project on ship_log(project_id);
alter publication supabase_realtime add table ship_log;

-- ── Onboarding Checklists ─────────────────────────────────────────────────────
create table if not exists onboarding_checklists (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  deal_id     uuid references deals(id) on delete cascade,
  items       jsonb not null default '[]',     -- [{task, done, completed_at}]
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table onboarding_checklists enable row level security;
create policy "onboarding_checklists_owner" on onboarding_checklists
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists idx_onboarding_user on onboarding_checklists(user_id);
create index if not exists idx_onboarding_deal on onboarding_checklists(deal_id);
alter publication supabase_realtime add table onboarding_checklists;

-- ── Deals — additional columns ────────────────────────────────────────────────
alter table deals add column if not exists loss_reason text;        -- price, timing, service, competitor, other
alter table deals add column if not exists competitor_id uuid references competitors(id);
alter table deals add column if not exists commission_usd real default 0;
alter table deals add column if not exists margin_pct real;
alter table deals add column if not exists lanes jsonb default '[]';  -- [{origin, destination, volume, rate}]
