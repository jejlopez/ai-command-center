# CRM Phase 1+2: Foundation + Workflow Structure

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working CRM with Leads tab, enhanced Deals, 4-layer badges, scoring, sequences, research packets, qualification, discovery, objections, and lead-to-deal conversion — replacing Pipedrive as the operational leads view.

**Architecture:** Expand Sales mode from 2 tabs (Sales/Playbook) to 3 tabs (Leads/Deals/Playbook). New `leads` table in Supabase becomes source of truth for leads, with Pipedrive sync filling it. Shared `contacts` table deduplicates contact data. Unified `activities` table powers timelines on both leads and deals. Badge computation and scoring run client-side from record data. Sequence state is stored but the engine tick (Phase 3+) is out of scope — this phase builds the data model and visual progress only.

**Tech Stack:** React + Vite (JSX), Supabase (Postgres + RLS + Realtime), Tailwind CSS, Framer Motion, lucide-react icons. All existing patterns from the codebase.

**Spec:** `docs/superpowers/specs/2026-04-15-crm-sales-operating-system-design.md`

---

## File Structure

### New files to create

```
supabase/migrations/20260415_crm_foundation.sql      — 13 new tables + deals enhancement

src/lib/leadScore.js                                   — lead score, whale score, quality badge
src/lib/dealHealth.js                                  — deal health score (replaces dealScore.js usage)
src/lib/badges.js                                      — attention badge computation, shared badge rendering
src/lib/nba.js                                         — next-best-action computation

src/hooks/useLeadsSupa.js                              — leads CRUD + realtime
src/hooks/useContactsSupa.js                           — contacts CRUD

src/components/sales/LeadsTab.jsx                      — leads table with filters, stats, quick actions
src/components/sales/LeadRow.jsx                       — single lead table row with badges + NBA
src/components/sales/LeadDetailPanel.jsx               — REWRITE (7 tabs, header, badges, scores, NBA)
src/components/sales/LeadTimeline.jsx                  — timeline tab (shared with deals)
src/components/sales/LeadResearch.jsx                  — research packet display + re-research
src/components/sales/LeadQualification.jsx             — smart filter questions
src/components/sales/LeadSequence.jsx                  — visual sequence progress
src/components/sales/ConvertToDeal.jsx                 — conversion flow

src/components/shared/BadgeZone.jsx                    — renders 4 badges (used by lead + deal panels)
src/components/shared/ScoreZone.jsx                    — renders scores + breakdown (used by both)
src/components/shared/NBAModule.jsx                    — renders NBA with action buttons (used by both)
src/components/shared/ActivityTimeline.jsx             — unified timeline component (used by both)

src/components/sales/DealDiscovery.jsx                 — discovery requirements grid (new deal tab)
src/components/sales/DealObjections.jsx                — objection tracker (new deal tab)
```

### Existing files to modify

```
src/views/Work.jsx                                     — add "leads" to salesTab state, render LeadsTab
src/components/sales/StatsBar.jsx                      — add leads count, Leads tab button
src/components/sales/PipelineBoard.jsx                 — add BadgeZone to deal cards
src/components/sales/DealRoomPanel.jsx                 — add badge zone, score zone, NBA, Discovery + Objections tabs
src/hooks/useOpsSupa.js                                — add leads fetch, contacts fetch
src/lib/dealScore.js                                   — keep for backward compat, import from dealHealth.js
```

---

## Task 1: Database Migration — All 13 New Tables + Deals Enhancement

**Files:**
- Create: `supabase/migrations/20260415_crm_foundation.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- CRM Foundation — 13 new tables + deals enhancement
-- Run in Supabase SQL Editor or via supabase db push

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
```

- [ ] **Step 2: Run the migration**

Run in Supabase SQL Editor or:
```bash
npx supabase db push
```
Expected: all 13 tables created, deals table has 13 new columns, no errors.

- [ ] **Step 3: Verify tables exist**

Run in SQL Editor:
```sql
select table_name from information_schema.tables
where table_schema = 'public'
order by table_name;
```
Expected: `activities`, `approvals`, `audit_log`, `contacts`, `discovery_requirements`, `leads`, `learning_events`, `objections`, `research_packets`, `sequence_steps`, `sequences`, `tracking_events`, `win_loss_reviews` all present alongside existing tables.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260415_crm_foundation.sql
git commit -m "feat: CRM foundation — 13 new tables + deals enhancement"
```

---

## Task 2: Scoring & Badge Utilities

**Files:**
- Create: `src/lib/leadScore.js`
- Create: `src/lib/dealHealth.js`
- Create: `src/lib/badges.js`
- Create: `src/lib/nba.js`

- [ ] **Step 1: Create `src/lib/leadScore.js`**

```js
// Lead scoring — ICP fit, volume, revenue, engagement, decision-maker, urgency, strategic.
// Returns { score, whale, quality, breakdown }.

const QUALITY_LABELS = [
  [90, "whale"], [75, "excellent"], [60, "strong"],
  [40, "medium"], [20, "weak"], [0, "bad_fit"],
];

export function leadScore(lead) {
  let score = 0;
  const b = {};

  // ICP fit (0-25): has research, is e-comm/D2C, relevant industry
  const rp = lead.research_packet || {};
  b.icp = 0;
  if (rp.ecommerce_signals) b.icp += 10;
  if (rp.what_they_do) b.icp += 5;
  if (rp.pain_points) b.icp += 5;
  if (rp.buying_triggers) b.icp += 5;
  score += b.icp;

  // Volume (0-20)
  b.volume = 0;
  const vol = rp.estimated_volume || lead.qualification?.daily_orders;
  if (vol) {
    const v = parseInt(vol, 10) || 0;
    if (v >= 500) b.volume = 20;
    else if (v >= 100) b.volume = 15;
    else if (v >= 50) b.volume = 10;
    else if (v > 0) b.volume = 5;
  }
  score += b.volume;

  // Revenue potential (0-15)
  b.revenue = 0;
  const val = lead.qualification?.estimated_monthly_value;
  if (val) {
    const v = parseInt(val, 10) || 0;
    if (v >= 20000) b.revenue = 15;
    else if (v >= 10000) b.revenue = 12;
    else if (v >= 5000) b.revenue = 8;
    else if (v > 0) b.revenue = 4;
  }
  score += b.revenue;

  // Engagement (0-15)
  b.engagement = 0;
  if (lead.strike_count >= 1) b.engagement += 3;
  if (lead.attention === "hot") b.engagement += 15;
  else if (lead.attention === "warm") b.engagement += 8;
  else if (lead.status === "sequence_active") b.engagement += 4;
  b.engagement = Math.min(15, b.engagement);
  score += b.engagement;

  // Decision-maker (0-10)
  b.decision_maker = 0;
  const q = lead.qualification || {};
  if (q.is_decision_maker === true || q.decision_maker_access === "direct") b.decision_maker = 10;
  else if (q.decision_maker_access === "indirect") b.decision_maker = 5;
  score += b.decision_maker;

  // Urgency (0-10)
  b.urgency = 0;
  if (q.timeline === "immediate") b.urgency = 10;
  else if (q.timeline === "30_days") b.urgency = 7;
  else if (q.timeline === "60_days") b.urgency = 4;
  else if (q.timeline === "exploring") b.urgency = 2;
  score += b.urgency;

  // Strategic (0-5)
  b.strategic = 0;
  if (lead.tags?.includes("marquee")) b.strategic += 3;
  if (lead.source === "referral") b.strategic += 2;
  score += b.strategic;

  // Disqualification deductions
  if (rp.ecommerce_signals === "none" || rp.ecommerce_signals === "no_website") score -= 15;
  if (q.bad_fit_reason) score -= 20;

  score = Math.max(0, Math.min(100, score));

  // Whale score (separate axis)
  let whale = 0;
  whale += Math.min(30, b.revenue * 2);
  whale += Math.min(25, b.volume * 1.25);
  whale += (q.services_needed?.length || 0) * 5; // multi-service, max 20
  whale = Math.min(whale, 75);
  if (rp.buying_triggers) whale += 15;
  if (b.strategic > 0) whale += 10;
  whale = Math.max(0, Math.min(100, whale));

  const quality = QUALITY_LABELS.find(([min]) => score >= min)?.[1] || "bad_fit";

  return { score, whale, quality, breakdown: b };
}
```

- [ ] **Step 2: Create `src/lib/dealHealth.js`**

```js
// Deal health scoring — activity recency, proposal engagement, replies,
// next step, discovery, urgency, objections.

const HEALTH_LABELS = [
  [90, "whale"], [75, "excellent"], [60, "strong"],
  [40, "medium"], [20, "weak"], [0, "bad_fit"],
];

export function dealHealth(deal, { activities = [], objections = [], discoveryReqs = [] } = {}) {
  let score = 0;
  const b = {};

  // Activity recency (0-20)
  b.activity = 0;
  const lastAct = deal.last_touch || deal.updated_at;
  if (lastAct) {
    const days = Math.floor((Date.now() - new Date(lastAct).getTime()) / 86_400_000);
    if (days <= 1) b.activity = 20;
    else if (days <= 3) b.activity = 16;
    else if (days <= 7) b.activity = 10;
    else if (days <= 10) b.activity = 5;
  }
  score += b.activity;

  // Proposal engagement (0-20)
  b.proposal = 0;
  if (deal.pandadoc_viewed || deal.proposal_viewed) {
    b.proposal += 10;
    const views = deal.pandadoc_view_count || deal.proposal_view_count || 1;
    if (views >= 3) b.proposal += 10;
    else if (views >= 2) b.proposal += 5;
  }
  score += b.proposal;

  // Reply behavior (0-15)
  b.replies = 0;
  if (deal.email_replied) b.replies += 10;
  if (deal.responded_within_24h) b.replies += 5;
  score += b.replies;

  // Next step clarity (0-15)
  b.next_step = 0;
  if (deal.next_activity) {
    const nextDate = new Date(deal.next_activity);
    if (nextDate >= new Date()) b.next_step = 15;
    else b.next_step = 5; // overdue but at least exists
  }
  score += b.next_step;

  // Discovery completeness (0-10)
  b.discovery = 0;
  if (discoveryReqs.length > 0) {
    const complete = discoveryReqs.filter(r => r.status === "complete").length;
    b.discovery = Math.round((complete / discoveryReqs.length) * 10);
  }
  score += b.discovery;

  // Buyer urgency (0-10)
  b.urgency = 0;
  if (deal.timeline === "immediate") b.urgency = 10;
  else if (deal.timeline === "30_days") b.urgency = 7;
  else if (deal.timeline === "60_days") b.urgency = 4;
  score += b.urgency;

  // Objection status (0-10)
  b.objections = 10; // full if no objections
  if (objections.length > 0) {
    const open = objections.filter(o => o.status === "open").length;
    b.objections = open === 0 ? 10 : Math.max(0, 10 - open * 3);
  }
  score += b.objections;

  // Penalties
  const age = deal.add_time ? Math.floor((Date.now() - new Date(deal.add_time).getTime()) / 86_400_000) : 0;
  const weeksStale = Math.max(0, Math.floor((age - 14) / 7));
  score -= weeksStale * 5;

  score = Math.max(0, Math.min(100, score));

  // Whale score for deals (from deal fields)
  let whale = 0;
  const annual = (deal.value || deal.value_usd || 0) * (deal.probability ? deal.probability / 100 : 1);
  if (annual >= 200000) whale += 30;
  else if (annual >= 100000) whale += 22;
  else if (annual >= 50000) whale += 15;
  else if (annual > 0) whale += 8;
  // Volume
  const vol = deal.volumes?.monthly_orders || 0;
  if (vol >= 500) whale += 25;
  else if (vol >= 100) whale += 18;
  else if (vol >= 50) whale += 10;
  // Multi-service
  whale += Math.min(20, (deal.services_needed?.length || 0) * 5);
  // Growth + strategic
  if (deal.timeline === "immediate") whale += 10;
  whale = Math.max(0, Math.min(100, whale));

  const quality = HEALTH_LABELS.find(([min]) => score >= min)?.[1] || "bad_fit";

  return { score, whale, quality, breakdown: b };
}

export function whaleQuadrant(whaleScore, healthScore) {
  if (whaleScore >= 80 && healthScore >= 60) return "true_whale";
  if (whaleScore >= 40 && healthScore >= 60) return "strong_regular";
  if (whaleScore < 40 && healthScore >= 70) return "fast_close";
  if (whaleScore >= 80 && healthScore < 40) return "longshot_whale";
  return "fake_active";
}
```

- [ ] **Step 3: Create `src/lib/badges.js`**

```js
// Badge computation — attention badge from behavioral signals.
// Process + strike + quality badges are stored on the record directly.

export function computeAttention(record, { activities = [], trackingEvents = [] } = {}) {
  const now = Date.now();
  const lastTouch = record.last_touch || record.updated_at;
  const daysSilent = lastTouch
    ? Math.floor((now - new Date(lastTouch).getTime()) / 86_400_000)
    : 999;

  // Check for hot signals in last 24h
  const recentEvents = trackingEvents.filter(
    e => (now - new Date(e.occurred_at).getTime()) < 86_400_000
  );
  const recentOpens = recentEvents.filter(e => e.event_type === "email_opened").length;
  const recentReplies = recentEvents.filter(e => e.event_type === "reply_received").length;
  const recentProposalViews = recentEvents.filter(e => e.event_type === "proposal_viewed").length;

  if (recentOpens >= 2 || recentReplies > 0 || recentProposalViews >= 2) return "hot";
  if (daysSilent <= 3) return "warm";
  if (daysSilent <= 10) return "stale";

  // At risk checks
  const hasUnresolvedObjection = record._openObjections > 0;
  if (daysSilent > 10 || hasUnresolvedObjection) return "at_risk";

  // Blocked
  if (record.status === "blocked" || record.attention === "blocked") return "blocked";

  return "warm";
}

// Badge color/style maps for rendering
export const PROCESS_COLORS = {
  new: "bg-white/5 text-jarvis-muted",
  researching: "bg-jarvis-purple/10 text-jarvis-purple",
  ready_to_email: "bg-blue-500/10 text-blue-400",
  sequence_active: "bg-jarvis-warning/10 text-jarvis-warning",
  waiting: "bg-white/5 text-jarvis-muted",
  discovery_set: "bg-jarvis-success/10 text-jarvis-success",
  qualified: "bg-jarvis-success/10 text-jarvis-success",
  converted: "bg-cyan-500/10 text-cyan-400",
  nurture: "bg-white/5 text-jarvis-ghost",
  dead: "bg-jarvis-danger/10 text-jarvis-danger",
  // deal stages
  discovery: "bg-jarvis-purple/10 text-jarvis-purple",
  proposal_drafting: "bg-blue-500/10 text-blue-400",
  proposal_sent: "bg-jarvis-warning/10 text-jarvis-warning",
  negotiating: "bg-orange-500/10 text-orange-400",
  closing: "bg-jarvis-success/10 text-jarvis-success",
  won: "bg-cyan-500/10 text-cyan-400",
  lost: "bg-jarvis-danger/10 text-jarvis-danger",
};

export const QUALITY_COLORS = {
  whale: "bg-gradient-to-r from-jarvis-success to-cyan-400 text-jarvis-bg",
  excellent: "bg-jarvis-success text-jarvis-bg",
  strong: "bg-jarvis-success/15 text-jarvis-success",
  medium: "bg-jarvis-warning/15 text-jarvis-warning",
  weak: "bg-white/5 text-jarvis-muted",
  bad_fit: "bg-jarvis-danger/15 text-jarvis-danger",
};

export const ATTENTION_COLORS = {
  hot: "bg-jarvis-danger text-white",
  warm: "bg-jarvis-warning/15 text-jarvis-warning",
  stale: "bg-white/5 text-jarvis-muted",
  at_risk: "bg-jarvis-danger/12 text-jarvis-danger",
  blocked: "bg-jarvis-danger/20 text-jarvis-danger",
};

export const QUALITY_LABELS = {
  whale: "🐋 WHALE", excellent: "Excellent", strong: "Strong",
  medium: "Medium", weak: "Weak", bad_fit: "Bad Fit",
};

export const ATTENTION_LABELS = {
  hot: "🔥 HOT", warm: "Warm", stale: "Stale",
  at_risk: "⚠ At Risk", blocked: "🚫 Blocked",
};
```

- [ ] **Step 4: Create `src/lib/nba.js`**

```js
// Next-best-action engine — computes { action, reason, due_at, priority } for leads and deals.

export function computeNBA(record, { type = "lead", sequence, trackingEvents = [] } = {}) {
  const now = Date.now();
  const daysSilent = record.last_touch
    ? Math.floor((now - new Date(record.last_touch).getTime()) / 86_400_000)
    : 0;

  // Check recent engagement
  const last24h = trackingEvents.filter(
    e => (now - new Date(e.occurred_at).getTime()) < 86_400_000
  );
  const recentOpens = last24h.filter(e => e.event_type === "email_opened").length;
  const recentProposalViews = last24h.filter(e => e.event_type === "proposal_viewed").length;

  // Hot engagement → CALL NOW
  if (recentOpens >= 3 || recentProposalViews >= 2) {
    return {
      action: "call_now",
      reason: recentProposalViews >= 2
        ? `Proposal viewed ${recentProposalViews}x in the last few hours. High interest.`
        : `Opened your email ${recentOpens}x today. Strike while hot.`,
      due_at: new Date().toISOString(),
      priority: 1,
    };
  }

  // Lead-specific
  if (type === "lead") {
    if (record.status === "new") {
      return { action: "research", reason: "New lead. Jarvis will research automatically.", due_at: null, priority: 5 };
    }
    if (record.status === "researching") {
      return { action: "wait_research", reason: "Research in progress.", due_at: null, priority: 8 };
    }
    if (record.status === "ready_to_email") {
      return { action: "send_email", reason: "Research complete. Draft ready for review.", due_at: new Date().toISOString(), priority: 3 };
    }
    if (record.status === "discovery_set") {
      return { action: "prep_call", reason: "Discovery call scheduled. Review research packet.", due_at: record.next_activity, priority: 2 };
    }
    if (record.status === "qualified") {
      return { action: "convert", reason: "Lead qualified. Ready to convert to deal.", due_at: new Date().toISOString(), priority: 2 };
    }
    if (record.strike_count >= 5) {
      return { action: "nurture_or_close", reason: "5 strikes. No engagement. Move to nurture or close.", due_at: null, priority: 9 };
    }
    if (daysSilent >= 5 && record.status === "sequence_active") {
      return { action: "follow_up", reason: `No activity for ${daysSilent} days. Sequence step due.`, due_at: sequence?.next_fire_at, priority: 4 };
    }
  }

  // Deal-specific
  if (type === "deal") {
    const stage = (record.stage_name || record.stage || "").toLowerCase();
    if (stage.includes("proposal") && !stage.includes("follow")) {
      return { action: "draft_proposal", reason: "Discovery complete. Ready to generate proposal.", due_at: null, priority: 3 };
    }
    if (daysSilent >= 4 && record.proposal_sent) {
      return { action: "follow_up", reason: `Proposal sent ${daysSilent} days ago. Time to follow up.`, due_at: new Date().toISOString(), priority: 3 };
    }
    if (record.attention === "at_risk") {
      return { action: "rescue", reason: "Deal at risk. Call or send targeted follow-up.", due_at: new Date().toISOString(), priority: 2 };
    }
  }

  // Default
  if (sequence?.next_fire_at) {
    const fireDate = new Date(sequence.next_fire_at);
    if (fireDate > new Date()) {
      return { action: "wait", reason: `Next sequence step fires ${fireDate.toLocaleDateString()}.`, due_at: sequence.next_fire_at, priority: 7 };
    }
  }

  return { action: "review", reason: "No urgent action. Review when convenient.", due_at: null, priority: 10 };
}
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/leadScore.js src/lib/dealHealth.js src/lib/badges.js src/lib/nba.js
git commit -m "feat: scoring engine — lead score, deal health, whale score, badges, NBA"
```

---

## Task 3: Leads Data Hook

**Files:**
- Create: `src/hooks/useLeadsSupa.js`

- [ ] **Step 1: Create the hook**

```js
// Leads hook — CRUD, realtime, scoring integration.

import { useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "../lib/supabase.js";
import { leadScore } from "../lib/leadScore.js";

const EMPTY = { leads: [], loading: true, error: null };

export function useLeadsSupa() {
  const [data, setData] = useState(EMPTY);
  const channelRef = useRef(null);

  const refresh = useCallback(async () => {
    if (!supabase) {
      setData({ leads: [], loading: false, error: "Supabase not configured" });
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      setData(d => ({ ...d, loading: false, error: "Not logged in" }));
      return;
    }
    try {
      const { data: leads, error } = await supabase
        .from("leads")
        .select("*, contacts(*)")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;

      // Compute scores client-side
      const scored = (leads || []).map(lead => {
        const { score, whale, quality, breakdown } = leadScore(lead);
        return { ...lead, lead_score: score, whale_score: whale, quality, _breakdown: breakdown };
      });

      // Sort by NBA priority (hot whales first, stale weak last)
      scored.sort((a, b) => {
        const aPri = (a.attention === "hot" ? 0 : a.attention === "warm" ? 1 : 2);
        const bPri = (b.attention === "hot" ? 0 : b.attention === "warm" ? 1 : 2);
        if (aPri !== bPri) return aPri - bPri;
        return (b.lead_score || 0) - (a.lead_score || 0);
      });

      setData({ leads: scored, loading: false, error: null });
    } catch (e) {
      setData(d => ({ ...d, loading: false, error: e.message }));
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  // Realtime subscription
  useEffect(() => {
    if (!supabase) return;
    const channel = supabase
      .channel("leads_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => refresh())
      .subscribe();
    channelRef.current = channel;
    return () => { channel.unsubscribe(); };
  }, [refresh]);

  const createLead = useCallback(async (fields) => {
    if (!supabase) return null;
    const { data: lead, error } = await supabase.from("leads").insert(fields).select().single();
    if (error) throw error;
    refresh();
    return lead;
  }, [refresh]);

  const updateLead = useCallback(async (id, fields) => {
    if (!supabase) return;
    const { error } = await supabase
      .from("leads")
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
    refresh();
  }, [refresh]);

  const deleteLead = useCallback(async (id) => {
    if (!supabase) return;
    await supabase.from("leads").delete().eq("id", id);
    refresh();
  }, [refresh]);

  return { ...data, refresh, createLead, updateLead, deleteLead };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useLeadsSupa.js
git commit -m "feat: useLeadsSupa hook — leads CRUD, realtime, client-side scoring"
```

---

## Task 4: Shared Badge, Score, NBA, and Timeline Components

**Files:**
- Create: `src/components/shared/BadgeZone.jsx`
- Create: `src/components/shared/ScoreZone.jsx`
- Create: `src/components/shared/NBAModule.jsx`
- Create: `src/components/shared/ActivityTimeline.jsx`

- [ ] **Step 1: Create `src/components/shared/BadgeZone.jsx`**

```jsx
// BadgeZone — renders all 4 badges for a lead or deal.

import { PROCESS_COLORS, QUALITY_COLORS, ATTENTION_COLORS, QUALITY_LABELS, ATTENTION_LABELS } from "../../lib/badges.js";

function Badge({ label, colorClass }) {
  if (!label) return null;
  return (
    <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${colorClass}`}>
      {label}
    </span>
  );
}

export function BadgeZone({ record, type = "lead" }) {
  const status = record.status || record.stage || "";
  const statusKey = status.toLowerCase().replace(/\s+/g, "_");

  return (
    <div className="flex gap-1.5 flex-wrap">
      <Badge
        label={status.replace(/_/g, " ")}
        colorClass={PROCESS_COLORS[statusKey] || "bg-white/5 text-jarvis-muted"}
      />
      {record.quality && (
        <Badge
          label={QUALITY_LABELS[record.quality] || record.quality}
          colorClass={record.quality === "whale"
            ? "bg-gradient-to-r from-green-400 to-cyan-400 text-slate-900 font-bold"
            : QUALITY_COLORS[record.quality] || ""}
        />
      )}
      {record.attention && (
        <Badge
          label={ATTENTION_LABELS[record.attention] || record.attention}
          colorClass={ATTENTION_COLORS[record.attention] || ""}
        />
      )}
      {record.strike_count != null && (
        <Badge
          label={`S${record.strike_count}`}
          colorClass={
            record.strike_count >= 4 ? "bg-jarvis-danger/15 text-jarvis-danger" :
            record.strike_count >= 2 ? "bg-jarvis-warning/15 text-jarvis-warning" :
            "bg-blue-500/10 text-blue-400"
          }
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/shared/ScoreZone.jsx`**

```jsx
// ScoreZone — lead score + whale score + breakdown.

export function ScoreZone({ score, whale, breakdown, labels = { score: "Score", whale: "Whale" } }) {
  const scoreColor = score >= 70 ? "text-jarvis-success" : score >= 40 ? "text-jarvis-warning" : "text-jarvis-danger";
  const whaleColor = whale >= 70 ? "text-cyan-400" : whale >= 40 ? "text-jarvis-warning" : "text-jarvis-muted";

  return (
    <div className="flex gap-5 items-end">
      <div>
        <div className="text-[8px] text-jarvis-muted uppercase tracking-[0.12em]">{labels.score}</div>
        <div className={`text-xl font-display font-bold tabular-nums ${scoreColor}`}>{score ?? "—"}</div>
      </div>
      <div>
        <div className="text-[8px] text-jarvis-muted uppercase tracking-[0.12em]">{labels.whale}</div>
        <div className={`text-xl font-display font-bold tabular-nums ${whaleColor}`}>{whale ?? "—"}</div>
      </div>
      {breakdown && (
        <div className="flex-1 text-[9px] text-jarvis-muted leading-relaxed">
          {Object.entries(breakdown).map(([k, v]) => (
            <span key={k} className="mr-2">{k.replace(/_/g, " ")} {v}</span>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/shared/NBAModule.jsx`**

```jsx
// NBAModule — next-best-action display with action buttons.

const ACTION_STYLES = {
  call_now: { color: "text-jarvis-danger", border: "border-jarvis-danger", bg: "bg-jarvis-danger/8", label: "CALL NOW" },
  send_email: { color: "text-jarvis-primary", border: "border-jarvis-primary", bg: "bg-jarvis-primary/8", label: "SEND EMAIL" },
  follow_up: { color: "text-jarvis-warning", border: "border-jarvis-warning", bg: "bg-jarvis-warning/8", label: "SEND FOLLOW-UP" },
  wait: { color: "text-blue-400", border: "border-blue-400", bg: "bg-blue-400/8", label: "WAIT" },
  research: { color: "text-jarvis-purple", border: "border-jarvis-purple", bg: "bg-jarvis-purple/8", label: "RESEARCH IN PROGRESS" },
  wait_research: { color: "text-jarvis-purple", border: "border-jarvis-purple", bg: "bg-jarvis-purple/8", label: "RESEARCH IN PROGRESS" },
  prep_call: { color: "text-jarvis-success", border: "border-jarvis-success", bg: "bg-jarvis-success/8", label: "PREP FOR CALL" },
  convert: { color: "text-cyan-400", border: "border-cyan-400", bg: "bg-cyan-400/8", label: "CONVERT TO DEAL" },
  draft_proposal: { color: "text-jarvis-success", border: "border-jarvis-success", bg: "bg-jarvis-success/8", label: "DRAFT PROPOSAL" },
  rescue: { color: "text-jarvis-danger", border: "border-jarvis-danger", bg: "bg-jarvis-danger/8", label: "RESCUE DEAL" },
  nurture_or_close: { color: "text-jarvis-muted", border: "border-jarvis-ghost", bg: "bg-white/3", label: "MOVE TO NURTURE" },
  review: { color: "text-jarvis-muted", border: "border-jarvis-ghost", bg: "bg-white/3", label: "REVIEW" },
};

export function NBAModule({ nba, contact, onAction }) {
  if (!nba) return null;
  const style = ACTION_STYLES[nba.action] || ACTION_STYLES.review;

  return (
    <div className={`${style.bg} border-l-[3px] ${style.border} px-3 py-2.5 rounded-r-lg`}>
      <div className={`text-xs font-bold ${style.color}`}>{style.label}</div>
      <div className="text-[10px] text-jarvis-muted mt-0.5">{nba.reason}</div>
      <div className="flex gap-2 mt-2">
        {(nba.action === "call_now" || nba.action === "prep_call") && contact?.phone && (
          <button onClick={() => onAction?.("call", contact)} className="text-[9px] bg-jarvis-danger/15 text-jarvis-danger px-2.5 py-1 rounded-md font-semibold">
            📞 Call {contact.phone}
          </button>
        )}
        {(nba.action === "send_email" || nba.action === "follow_up") && (
          <button onClick={() => onAction?.("email")} className="text-[9px] bg-jarvis-primary/15 text-jarvis-primary px-2.5 py-1 rounded-md font-semibold">
            ✉ Draft Email
          </button>
        )}
        {nba.action === "convert" && (
          <button onClick={() => onAction?.("convert")} className="text-[9px] bg-cyan-400/15 text-cyan-400 px-2.5 py-1 rounded-md font-semibold">
            → Convert to Deal
          </button>
        )}
        <button onClick={() => onAction?.("snooze")} className="text-[9px] bg-white/5 text-jarvis-muted px-2.5 py-1 rounded-md">
          ⏸ Snooze
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/shared/ActivityTimeline.jsx`**

```jsx
// ActivityTimeline — unified chronological feed for leads and deals.
// Reads from `activities` table.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";

const TYPE_DOTS = {
  email_sent: "bg-jarvis-purple",
  email_received: "bg-jarvis-success",
  call: "bg-orange-400",
  meeting: "bg-blue-400",
  note: "bg-jarvis-warning",
  proposal_sent: "bg-blue-400",
  proposal_viewed: "bg-jarvis-warning",
  stage_change: "bg-cyan-400",
  research_completed: "bg-jarvis-success",
  jarvis_action: "bg-jarvis-purple",
  approval_decision: "bg-jarvis-warning",
};

const TYPE_LABELS = {
  email_sent: "Email sent",
  email_received: "Email received",
  call: "Call",
  meeting: "Meeting",
  note: "Note",
  proposal_sent: "Proposal sent",
  proposal_viewed: "Proposal viewed",
  stage_change: "Stage change",
  research_completed: "Research completed",
  jarvis_action: "Jarvis action",
  approval_decision: "Approval decision",
};

function groupByDate(items) {
  const groups = {};
  for (const item of items) {
    const date = new Date(item.occurred_at || item.created_at).toLocaleDateString("en-US", {
      weekday: "short", month: "short", day: "numeric",
    });
    (groups[date] ??= []).push(item);
  }
  return Object.entries(groups);
}

export function ActivityTimeline({ leadId, dealId }) {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      let query = supabase.from("activities").select("*").order("occurred_at", { ascending: false }).limit(50);
      if (leadId) query = query.eq("lead_id", leadId);
      if (dealId) query = query.eq("deal_id", dealId);
      const { data } = await query;
      setActivities(data || []);
      setLoading(false);
    })();
  }, [leadId, dealId]);

  if (loading) return <div className="text-[10px] text-jarvis-muted animate-pulse py-4">Loading timeline…</div>;
  if (activities.length === 0) return <div className="text-[10px] text-jarvis-ghost py-4">No activity yet.</div>;

  return (
    <div className="space-y-4">
      {groupByDate(activities).map(([date, items]) => (
        <div key={date}>
          <div className="text-[8px] text-jarvis-ghost uppercase tracking-wider mb-2">{date}</div>
          <div className="flex flex-col gap-3">
            {items.map(a => (
              <div key={a.id} className="flex gap-3">
                <div className="flex flex-col items-center min-w-[20px]">
                  <div className={`w-2 h-2 rounded-full mt-1 ${TYPE_DOTS[a.type] || "bg-jarvis-ghost"}`} />
                  <div className="w-px flex-1 bg-jarvis-border/20" />
                </div>
                <div className="flex-1 pb-1">
                  <div className="text-[11px] text-jarvis-ink">
                    <span className={`font-semibold ${(TYPE_DOTS[a.type] || "").replace("bg-", "text-")}`}>
                      {TYPE_LABELS[a.type] || a.type}
                    </span>
                    {a.subject && <span className="text-jarvis-muted"> · {a.subject}</span>}
                  </div>
                  {a.body && <div className="text-[10px] text-jarvis-muted mt-0.5 line-clamp-2">{a.body}</div>}
                  <div className="text-[9px] text-jarvis-ghost mt-0.5">
                    {new Date(a.occurred_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    {a.source && a.source !== "manual" && <span> · {a.source}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Commit**

```bash
git add src/components/shared/BadgeZone.jsx src/components/shared/ScoreZone.jsx src/components/shared/NBAModule.jsx src/components/shared/ActivityTimeline.jsx
git commit -m "feat: shared CRM components — BadgeZone, ScoreZone, NBAModule, ActivityTimeline"
```

---

## Task 5: Leads Tab + Lead Row

**Files:**
- Create: `src/components/sales/LeadsTab.jsx`
- Create: `src/components/sales/LeadRow.jsx`

- [ ] **Step 1: Create `src/components/sales/LeadRow.jsx`**

```jsx
// Single row in the leads table — badges, score, NBA.

import { BadgeZone } from "../shared/BadgeZone.jsx";

const NBA_COLORS = {
  call_now: "border-jarvis-danger text-jarvis-danger",
  send_email: "border-jarvis-primary text-jarvis-primary",
  follow_up: "border-jarvis-warning text-jarvis-warning",
  wait: "border-blue-400 text-blue-400",
  research: "border-jarvis-purple text-jarvis-purple",
  wait_research: "border-jarvis-purple text-jarvis-purple",
  prep_call: "border-jarvis-success text-jarvis-success",
  convert: "border-cyan-400 text-cyan-400",
  draft_proposal: "border-jarvis-success text-jarvis-success",
  nurture_or_close: "border-jarvis-ghost text-jarvis-muted",
  review: "border-jarvis-ghost text-jarvis-muted",
  rescue: "border-jarvis-danger text-jarvis-danger",
};

const NBA_LABELS = {
  call_now: "CALL NOW", send_email: "SEND EMAIL", follow_up: "FOLLOW UP",
  wait: "WAIT", research: "RESEARCHING", wait_research: "RESEARCHING",
  prep_call: "PREP FOR CALL", convert: "CONVERT", draft_proposal: "DRAFT PROPOSAL",
  nurture_or_close: "NURTURE / CLOSE", review: "REVIEW", rescue: "RESCUE",
};

export function LeadRow({ lead, onClick }) {
  const contact = lead.contacts || {};
  const nba = lead.next_best_action || {};
  const nbaStyle = NBA_COLORS[nba.action] || NBA_COLORS.review;
  const scoreColor = (lead.lead_score || 0) >= 70 ? "text-jarvis-success"
    : (lead.lead_score || 0) >= 40 ? "text-jarvis-warning" : "text-jarvis-muted";

  return (
    <div
      className={`grid grid-cols-[2fr_0.8fr_0.6fr_0.6fr_0.6fr_1fr_1.2fr] gap-1 px-5 py-2.5 border-b border-jarvis-border/20 items-center cursor-pointer transition hover:bg-jarvis-surface-hover ${lead.attention === "hot" ? "bg-jarvis-danger/[0.02]" : ""}`}
      onClick={() => onClick?.(lead)}
    >
      {/* Company + Contact */}
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-jarvis-ink truncate">{lead.company}</div>
        <div className="text-[10px] text-jarvis-muted truncate">
          {contact.name || "—"}{contact.email ? ` · ${contact.email}` : ""}
        </div>
      </div>

      {/* Quality */}
      <div>
        {lead.quality && (
          <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
            lead.quality === "whale"
              ? "bg-gradient-to-r from-green-400 to-cyan-400 text-slate-900"
              : lead.quality === "excellent" ? "bg-jarvis-success text-jarvis-bg"
              : lead.quality === "strong" ? "bg-jarvis-success/15 text-jarvis-success"
              : lead.quality === "medium" ? "bg-jarvis-warning/15 text-jarvis-warning"
              : "bg-white/5 text-jarvis-muted"
          }`}>
            {lead.quality === "whale" ? "🐋 WHALE" : lead.quality}
          </span>
        )}
      </div>

      {/* Attention */}
      <div>
        {lead.attention && (
          <span className={`text-[8px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold ${
            lead.attention === "hot" ? "bg-jarvis-danger text-white"
            : lead.attention === "warm" ? "bg-jarvis-warning/15 text-jarvis-warning"
            : lead.attention === "stale" ? "bg-white/5 text-jarvis-muted"
            : lead.attention === "at_risk" ? "bg-jarvis-danger/12 text-jarvis-danger"
            : "bg-jarvis-danger/20 text-jarvis-danger"
          }`}>
            {lead.attention === "hot" ? "🔥 HOT" : lead.attention === "at_risk" ? "⚠ At Risk" : lead.attention}
          </span>
        )}
      </div>

      {/* Strike */}
      <div>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
          lead.strike_count >= 4 ? "bg-jarvis-danger/15 text-jarvis-danger"
          : lead.strike_count >= 2 ? "bg-jarvis-warning/15 text-jarvis-warning"
          : "bg-blue-500/10 text-blue-400"
        }`}>
          S{lead.strike_count || 0}
        </span>
      </div>

      {/* Score */}
      <div className={`text-sm font-bold tabular-nums ${scoreColor}`}>
        {lead.lead_score ?? "—"}
      </div>

      {/* Status */}
      <div>
        <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-jarvis-muted">
          {(lead.status || "new").replace(/_/g, " ")}
        </span>
      </div>

      {/* NBA */}
      <div className={`border-l-2 pl-2 ${nbaStyle}`}>
        <div className="text-[10px] font-semibold">{NBA_LABELS[nba.action] || "—"}</div>
        <div className="text-[9px] text-jarvis-ghost truncate">{nba.reason || ""}</div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/sales/LeadsTab.jsx`**

```jsx
// LeadsTab — full leads inbox table with filters, stats, and click-to-detail.

import { useState } from "react";
import { motion } from "framer-motion";
import { stagger } from "../../lib/motion.js";
import { useLeadsSupa } from "../../hooks/useLeadsSupa.js";
import { LeadRow } from "./LeadRow.jsx";
import { LeadDetailPanel } from "./LeadDetailPanel.jsx";
import { Plus, RefreshCcw } from "lucide-react";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "hot", label: "🔥 Hot", filter: l => l.attention === "hot" },
  { key: "whale", label: "Whale", filter: l => l.quality === "whale" },
  { key: "sequence", label: "Sequence Active", filter: l => l.status === "sequence_active" },
  { key: "stale", label: "Stale", filter: l => l.attention === "stale" || l.attention === "at_risk" },
];

export function LeadsTab({ crm }) {
  const { leads, loading, refresh, createLead } = useLeadsSupa();
  const [filter, setFilter] = useState("all");
  const [selectedLead, setSelectedLead] = useState(null);

  const activeFilter = FILTERS.find(f => f.key === filter);
  const filtered = activeFilter?.filter ? leads.filter(activeFilter.filter) : leads;

  const stats = {
    total: leads.length,
    hot: leads.filter(l => l.attention === "hot").length,
    sequencing: leads.filter(l => l.status === "sequence_active").length,
    discoverySet: leads.filter(l => l.status === "discovery_set").length,
    qualified: leads.filter(l => l.status === "qualified").length,
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full text-xs text-jarvis-muted animate-pulse">Loading leads…</div>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-5 py-2.5 border-b border-jarvis-border/30 text-[10px]">
        <span className="text-jarvis-ghost">Filter:</span>
        {FILTERS.map(f => {
          const count = f.filter ? leads.filter(f.filter).length : leads.length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-2.5 py-1 rounded-full transition ${
                filter === f.key
                  ? "bg-jarvis-primary/15 text-jarvis-primary"
                  : "bg-white/4 text-jarvis-muted hover:text-jarvis-ink"
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
        <div className="flex-1" />
        <button
          onClick={() => createLead({ company: "New Lead", status: "new" })}
          className="px-2.5 py-1 rounded-full bg-jarvis-primary/10 text-jarvis-primary font-medium flex items-center gap-1"
        >
          <Plus size={10} /> New Lead
        </button>
        <button
          onClick={refresh}
          className="px-2.5 py-1 rounded-full bg-jarvis-success/10 text-jarvis-success flex items-center gap-1"
        >
          <RefreshCcw size={10} /> Refresh
        </button>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[2fr_0.8fr_0.6fr_0.6fr_0.6fr_1fr_1.2fr] gap-1 px-5 py-2 border-b border-jarvis-border/40 text-[8px] text-jarvis-ghost uppercase tracking-[0.1em]">
        <div>Company / Contact</div>
        <div>Quality</div>
        <div>Attention</div>
        <div>Strike</div>
        <div>Score</div>
        <div>Status</div>
        <div>Next Best Action</div>
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8 text-[11px] text-jarvis-ghost">No leads match this filter.</div>
        ) : (
          <motion.div variants={stagger.container} initial="hidden" animate="show">
            {filtered.map(lead => (
              <motion.div key={lead.id} variants={stagger.item}>
                <LeadRow lead={lead} onClick={setSelectedLead} />
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* Detail panel */}
      {selectedLead && (
        <LeadDetailPanel
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onRefresh={refresh}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/sales/LeadRow.jsx src/components/sales/LeadsTab.jsx
git commit -m "feat: LeadsTab — full inbox table with filters, badges, scores, NBA column"
```

---

## Task 6: Wire Leads Tab into Work View

**Files:**
- Modify: `src/views/Work.jsx`
- Modify: `src/components/sales/StatsBar.jsx`

- [ ] **Step 1: Update Work.jsx — add LeadsTab import and "leads" salesTab state**

In `src/views/Work.jsx`, add the import at the top with the other sales imports:

```jsx
import { LeadsTab } from "../components/sales/LeadsTab.jsx";
```

Then change the default salesTab state from `"sales"` to `"deals"` and add the leads rendering:

Replace the salesTab state initialization:
```jsx
const [salesTab, setSalesTab] = useState("sales");
```
with:
```jsx
const [salesTab, setSalesTab] = useState("deals");
```

Replace the sales tab rendering block. Find this section:
```jsx
{!loading && mode === "sales" && salesTab === "sales" && (
  <SalesDashboard ops={ops} onRefresh={refresh} />
```
and replace with:
```jsx
{!loading && mode === "sales" && salesTab === "leads" && (
  <LeadsTab crm={crm} />
)}

{!loading && mode === "sales" && salesTab === "deals" && (
  <SalesDashboard ops={ops} onRefresh={refresh} />
```

Also update the playbook condition from `salesTab === "playbook"` — it should remain unchanged since PlaybookTab already checks for `"playbook"`.

- [ ] **Step 2: Update StatsBar.jsx — add Leads tab button, leads count**

In `src/components/sales/StatsBar.jsx`, add a `leads` prop and "Leads" tab button. Add to the component props:

```jsx
export function StatsBar({ deals = [], proposals = [], followUps = [], leads = [], activeTab, onTabChange }) {
```

Add a leads stat before the Pipeline stat:
```jsx
<Stat label="Leads" value={leads.length} color="text-blue-400" />
```

Add a "Leads" button before the "Sales" button in the tab switcher:
```jsx
<button
  onClick={() => onTabChange("leads")}
  className={`text-[11px] px-3.5 py-1.5 rounded-lg transition font-medium ${
    activeTab === "leads"
      ? "bg-jarvis-primary/15 text-jarvis-primary"
      : "text-jarvis-muted hover:text-jarvis-ink"
  }`}
>
  Leads
</button>
```

Rename the "Sales" button label to "Deals":
Change the button text from `Sales` to `Deals` and its tab value from `"sales"` to `"deals"`.

- [ ] **Step 3: Update Work.jsx — pass leads to StatsBar**

In the StatsBar render, add the leads prop. The `useLeadsSupa` hook should be called at the Work component level. Add the import and hook call:

```jsx
import { useLeadsSupa } from "../hooks/useLeadsSupa.js";
```

Inside the Work component, add:
```jsx
const { leads: supaLeads } = useLeadsSupa();
```

Update the StatsBar component to pass leads:
```jsx
<StatsBar
  deals={mergedDeals}
  proposals={proposals}
  followUps={followUps}
  leads={supaLeads}
  activeTab={salesTab}
  onTabChange={setSalesTab}
/>
```

- [ ] **Step 4: Test in browser**

```bash
npm run dev
```

Open the app, navigate to Work → Sales mode. You should see three tab buttons: **Leads | Deals | Playbook**. Leads tab shows the table (empty if no data yet). Deals tab shows the existing 3-column layout. Playbook unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/views/Work.jsx src/components/sales/StatsBar.jsx
git commit -m "feat: wire Leads tab into Work view — 3-tab layout (Leads, Deals, Playbook)"
```

---

## Task 7: Rewrite LeadDetailPanel — 7-Tab Slide-Out

**Files:**
- Rewrite: `src/components/sales/LeadDetailPanel.jsx`
- Create: `src/components/sales/LeadResearch.jsx`
- Create: `src/components/sales/LeadQualification.jsx`
- Create: `src/components/sales/LeadSequence.jsx`
- Create: `src/components/sales/ConvertToDeal.jsx`

- [ ] **Step 1: Create `src/components/sales/LeadResearch.jsx`**

```jsx
// Research tab — displays research packet, re-research button.

import { useState } from "react";
import { Search, RefreshCcw, Loader2 } from "lucide-react";
import { jarvis } from "../../lib/jarvis.js";

const SECTIONS = [
  { key: "company_overview", label: "Company Overview" },
  { key: "what_they_do", label: "What They Do" },
  { key: "ecommerce_signals", label: "E-Commerce Signals" },
  { key: "estimated_volume", label: "Estimated Volume" },
  { key: "revenue_clues", label: "Revenue Clues" },
  { key: "tech_stack", label: "Tech Stack" },
  { key: "linkedin_info", label: "LinkedIn / Company Profile" },
  { key: "pain_points", label: "Pain Points" },
  { key: "buying_triggers", label: "Buying Triggers" },
  { key: "qualification_notes", label: "Qualification Notes" },
  { key: "recommended_angle", label: "Recommended Opening Angle" },
];

export function LeadResearch({ lead, onRefresh }) {
  const [researching, setResearching] = useState(false);
  const rp = lead.research_packet || {};

  const doResearch = async () => {
    setResearching(true);
    try {
      await jarvis.runSkill("lead_research", {
        leadId: lead.id,
        company: lead.company,
        contactName: lead.contacts?.name,
        contactEmail: lead.contacts?.email,
      });
      onRefresh?.();
    } catch {} finally {
      setResearching(false);
    }
  };

  const hasResearch = SECTIONS.some(s => rp[s.key]);

  return (
    <div className="space-y-3 p-4">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-jarvis-ghost uppercase tracking-wider">Research Packet</div>
        <button
          onClick={doResearch}
          disabled={researching}
          className="text-[10px] px-3 py-1 rounded-md bg-jarvis-purple/10 text-jarvis-purple font-medium flex items-center gap-1 disabled:opacity-50"
        >
          {researching ? <Loader2 size={10} className="animate-spin" /> : <RefreshCcw size={10} />}
          {hasResearch ? "Re-Research" : "Research Now"}
        </button>
      </div>

      {!hasResearch ? (
        <div className="text-center py-8 text-[11px] text-jarvis-muted">
          No research yet. Click "Research Now" to analyze this lead.
        </div>
      ) : (
        <div className="space-y-2">
          {SECTIONS.map(({ key, label }) => {
            const val = rp[key];
            if (!val) return null;
            return (
              <div key={key} className="surface p-3">
                <div className="text-[9px] text-jarvis-primary font-semibold uppercase tracking-wider mb-1">{label}</div>
                <div className="text-[11px] text-jarvis-body leading-relaxed whitespace-pre-wrap">{val}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/sales/LeadQualification.jsx`**

```jsx
// Qualification tab — smart filter questions, updates lead score in real-time.

import { useState } from "react";
import { supabase } from "../../lib/supabase.js";

const QUESTIONS = [
  { key: "daily_orders", label: "How many daily orders?", type: "text", placeholder: "e.g. 200" },
  { key: "current_provider", label: "Current fulfillment provider?", type: "text", placeholder: "e.g. ShipBob, in-house" },
  { key: "monthly_spend", label: "Estimated monthly spend?", type: "text", placeholder: "e.g. $15,000" },
  { key: "services_needed", label: "Services needed?", type: "text", placeholder: "e.g. pick/pack, storage, returns" },
  { key: "timeline", label: "Decision timeline?", type: "select", options: ["immediate", "30_days", "60_days", "exploring"] },
  { key: "decision_maker_access", label: "Decision maker access?", type: "select", options: ["direct", "indirect", "unknown"] },
  { key: "is_decision_maker", label: "Is this contact the decision maker?", type: "select", options: ["true", "false", "unknown"] },
  { key: "estimated_monthly_value", label: "Estimated monthly value to us?", type: "text", placeholder: "e.g. 12000" },
  { key: "bad_fit_reason", label: "Disqualification reason (if any)?", type: "text", placeholder: "Leave blank if none" },
];

export function LeadQualification({ lead, onRefresh }) {
  const qual = lead.qualification || {};
  const [form, setForm] = useState(qual);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!supabase) return;
    setSaving(true);
    await supabase.from("leads").update({ qualification: form, updated_at: new Date().toISOString() }).eq("id", lead.id);
    setSaving(false);
    onRefresh?.();
  };

  const update = (key, value) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  return (
    <div className="p-4 space-y-3">
      <div className="text-[10px] text-jarvis-ghost uppercase tracking-wider">Qualification — Smart Filters</div>

      <div className="space-y-2">
        {QUESTIONS.map(q => (
          <div key={q.key} className="surface p-3">
            <label className="text-[10px] text-jarvis-muted font-medium block mb-1">{q.label}</label>
            {q.type === "select" ? (
              <select
                value={form[q.key] || ""}
                onChange={e => update(q.key, e.target.value)}
                className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1 text-[11px] text-jarvis-ink"
              >
                <option value="">—</option>
                {q.options.map(o => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={form[q.key] || ""}
                onChange={e => update(q.key, e.target.value)}
                placeholder={q.placeholder}
                className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1 text-[11px] text-jarvis-ink placeholder:text-jarvis-ghost"
              />
            )}
          </div>
        ))}
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="w-full py-2 rounded-lg bg-jarvis-primary/15 text-jarvis-primary text-[11px] font-semibold disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Qualification"}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/sales/LeadSequence.jsx`**

```jsx
// Sequence tab — visual 5-strike progress.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";

const STEP_COLORS = ["bg-blue-400", "bg-jarvis-purple", "bg-jarvis-warning", "bg-orange-400", "bg-jarvis-danger", "bg-jarvis-muted"];

export function LeadSequence({ leadId }) {
  const [sequence, setSequence] = useState(null);
  const [steps, setSteps] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !leadId) { setLoading(false); return; }
    (async () => {
      const { data: seqs } = await supabase.from("sequences").select("*").eq("lead_id", leadId).order("started_at", { ascending: false }).limit(1);
      if (seqs?.length) {
        setSequence(seqs[0]);
        const { data: stps } = await supabase.from("sequence_steps").select("*").eq("sequence_id", seqs[0].id).order("step_number");
        setSteps(stps || []);
      }
      setLoading(false);
    })();
  }, [leadId]);

  if (loading) return <div className="text-[10px] text-jarvis-muted animate-pulse p-4">Loading sequence…</div>;

  if (!sequence) {
    return (
      <div className="text-center py-8 text-[11px] text-jarvis-muted p-4">
        No active sequence. Start outreach to create one.
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-jarvis-ghost uppercase tracking-wider">
          {sequence.type?.replace(/_/g, " ")} · {sequence.status}
        </div>
        {sequence.next_fire_at && (
          <div className="text-[9px] text-jarvis-muted">
            Next step: {new Date(sequence.next_fire_at).toLocaleDateString()}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-0">
        {steps.map((step, i) => {
          const isCurrent = i === sequence.current_step;
          const isDone = step.status === "completed";
          const isSkipped = step.status === "skipped";

          return (
            <div key={step.id} className="flex gap-3 items-start">
              <div className="flex flex-col items-center min-w-[32px]">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold ${
                  isDone ? "bg-jarvis-success text-jarvis-bg" :
                  isSkipped ? "bg-jarvis-ghost/20 text-jarvis-ghost" :
                  isCurrent ? `${STEP_COLORS[i] || STEP_COLORS[5]} text-jarvis-bg` :
                  "bg-white/5 text-jarvis-ghost"
                }`}>
                  {isDone ? "✓" : isSkipped ? "—" : `S${step.step_number}`}
                </div>
                {i < steps.length - 1 && <div className="w-0.5 h-6 bg-jarvis-border/20" />}
              </div>
              <div className={`pb-3 ${isCurrent ? "" : "opacity-60"}`}>
                <div className="text-[11px] font-semibold text-jarvis-ink">
                  {step.action.replace(/_/g, " ").toUpperCase()}
                  {step.delay_days > 0 && <span className="text-jarvis-ghost font-normal"> · Day {step.delay_days}</span>}
                </div>
                {step.result && (
                  <div className="text-[9px] text-jarvis-muted mt-0.5">
                    {step.result.opened && "Opened"} {step.result.replied && "· Replied"} {step.result.call_connected && "· Connected"}
                  </div>
                )}
                {step.behavioral_override && (
                  <div className="text-[9px] text-cyan-400 mt-0.5">🔀 {JSON.stringify(step.behavioral_override)}</div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/sales/ConvertToDeal.jsx`**

```jsx
// Convert lead to deal — one-click conversion with history preservation.

import { useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { Loader2 } from "lucide-react";

export function ConvertToDeal({ lead, onConverted }) {
  const [converting, setConverting] = useState(false);

  const convert = async () => {
    if (!supabase || converting) return;
    setConverting(true);
    try {
      // 1. Create the deal
      const { data: deal, error: dealErr } = await supabase.from("deals").insert({
        company: lead.company,
        contact_name: lead.contacts?.name,
        contact_id: lead.contact_id,
        stage: "Discovery",
        value_usd: lead.qualification?.estimated_monthly_value
          ? parseInt(lead.qualification.estimated_monthly_value, 10) * 12
          : null,
        quality: lead.quality,
        attention: lead.attention,
        whale_score: lead.whale_score,
        volumes: lead.qualification?.daily_orders ? { monthly_orders: parseInt(lead.qualification.daily_orders, 10) * 30 } : null,
        services_needed: lead.qualification?.services_needed?.split(",").map(s => s.trim()) || [],
        decision_maker: lead.contacts?.name,
        timeline: lead.qualification?.timeline,
        current_provider: lead.qualification?.current_provider,
        switch_reason: lead.research_packet?.pain_points,
        converted_from_lead_id: lead.id,
        notes: lead.notes,
      }).select().single();

      if (dealErr) throw dealErr;

      // 2. Copy activities from lead to deal
      const { data: acts } = await supabase.from("activities").select("*").eq("lead_id", lead.id);
      if (acts?.length) {
        const copies = acts.map(a => ({
          user_id: a.user_id,
          deal_id: deal.id,
          lead_id: a.lead_id, // keep the lead link too
          contact_id: a.contact_id,
          type: a.type,
          subject: a.subject,
          body: a.body,
          metadata: a.metadata,
          source: a.source,
          occurred_at: a.occurred_at,
        }));
        await supabase.from("activities").insert(copies);
      }

      // 3. Create default discovery requirements
      const defaultReqs = [
        { category: "volume", question: "Monthly order volume?" },
        { category: "services", question: "Which services do they need?" },
        { category: "timeline", question: "When do they want to start?" },
        { category: "budget", question: "What is their budget range?" },
        { category: "decision_process", question: "Who makes the final decision?" },
        { category: "current_provider", question: "Who handles fulfillment now?" },
      ];
      const reqs = defaultReqs.map(r => ({
        deal_id: deal.id,
        ...r,
        status: lead.qualification?.[r.category.replace("_process", "_maker_access")] ? "partial" : "unknown",
        answer: lead.qualification?.[r.category] || null,
      }));
      await supabase.from("discovery_requirements").insert(reqs);

      // 4. Update lead as converted
      await supabase.from("leads").update({
        status: "converted",
        deal_id: deal.id,
        converted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);

      // 5. Cancel any active lead sequence
      await supabase.from("sequences").update({ status: "cancelled" }).eq("lead_id", lead.id).eq("status", "active");

      onConverted?.(deal);
    } catch (e) {
      console.error("Convert failed:", e);
    } finally {
      setConverting(false);
    }
  };

  if (lead.status === "converted") {
    return (
      <div className="text-[10px] text-cyan-400 flex items-center gap-1">
        ✓ Converted to deal
      </div>
    );
  }

  return (
    <button
      onClick={convert}
      disabled={converting}
      className="text-[10px] px-3 py-1.5 rounded-lg bg-cyan-400/15 text-cyan-400 font-semibold flex items-center gap-1 disabled:opacity-50"
    >
      {converting ? <Loader2 size={10} className="animate-spin" /> : "→"} Convert to Deal
    </button>
  );
}
```

- [ ] **Step 5: Rewrite `src/components/sales/LeadDetailPanel.jsx`**

This is a full rewrite. The new panel has: header with badges + scores + NBA, 7 tabs, convert-to-deal action. Read the existing file first, then replace it entirely:

```jsx
// LeadDetailPanel — slide-out showing everything about a lead.
// 7 tabs: Timeline, Research, Emails, Qualification, Sequence, Notes, Approvals.

import { useState } from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import { BadgeZone } from "../shared/BadgeZone.jsx";
import { ScoreZone } from "../shared/ScoreZone.jsx";
import { NBAModule } from "../shared/NBAModule.jsx";
import { ActivityTimeline } from "../shared/ActivityTimeline.jsx";
import { LeadResearch } from "./LeadResearch.jsx";
import { LeadQualification } from "./LeadQualification.jsx";
import { LeadSequence } from "./LeadSequence.jsx";
import { ConvertToDeal } from "./ConvertToDeal.jsx";
import { computeNBA } from "../../lib/nba.js";

const TABS = [
  { id: "timeline", label: "Timeline" },
  { id: "research", label: "Research" },
  { id: "emails", label: "Emails" },
  { id: "qualification", label: "Qualification" },
  { id: "sequence", label: "Sequence" },
  { id: "notes", label: "Notes" },
  { id: "approvals", label: "Approvals" },
];

export function LeadDetailPanel({ lead, onClose, onRefresh }) {
  const [tab, setTab] = useState("timeline");
  const contact = lead.contacts || {};
  const nba = lead.next_best_action || computeNBA(lead, { type: "lead" });

  const age = lead.created_at
    ? Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86_400_000)
    : 0;

  return (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 300 }}
      className="fixed top-0 right-0 h-full w-[520px] bg-jarvis-surface border-l border-jarvis-border z-50 flex flex-col shadow-2xl"
    >
      {/* Header */}
      <div className="p-4 border-b border-jarvis-border/50">
        <div className="flex justify-between items-start">
          <div>
            <div className="text-lg font-bold text-jarvis-ink">{lead.company}</div>
            <div className="text-[11px] text-jarvis-muted mt-0.5">
              {contact.name || "—"}{contact.email ? ` · ${contact.email}` : ""}{contact.phone ? ` · ${contact.phone}` : ""}
            </div>
            <div className="text-[9px] text-jarvis-ghost mt-1">
              Source: {lead.source || "—"} · Added {age} days ago
            </div>
          </div>
          <div className="flex items-center gap-2">
            {(lead.status === "qualified" || lead.status === "discovery_set") && (
              <ConvertToDeal lead={lead} onConverted={() => { onRefresh?.(); onClose?.(); }} />
            )}
            <button onClick={onClose} className="text-jarvis-ghost hover:text-jarvis-ink transition p-1">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Badges */}
        <div className="mt-3">
          <BadgeZone record={lead} type="lead" />
        </div>

        {/* Scores */}
        <div className="mt-3">
          <ScoreZone
            score={lead.lead_score}
            whale={lead.whale_score}
            breakdown={lead._breakdown}
            labels={{ score: "Lead Score", whale: "Whale Score" }}
          />
        </div>

        {/* NBA */}
        <div className="mt-3">
          <NBAModule nba={nba} contact={contact} onAction={(action) => {
            // TODO Phase 3: wire to approval flow
            console.log("NBA action:", action);
          }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-jarvis-border/50 px-4 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2.5 text-[10px] font-medium whitespace-nowrap transition ${
              tab === t.id
                ? "text-jarvis-primary border-b-2 border-jarvis-primary"
                : "text-jarvis-muted hover:text-jarvis-ink"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === "timeline" && <div className="p-4"><ActivityTimeline leadId={lead.id} /></div>}
        {tab === "research" && <LeadResearch lead={lead} onRefresh={onRefresh} />}
        {tab === "emails" && (
          <div className="p-4 text-[11px] text-jarvis-muted">
            Email history for this contact. Wired to email_triage in Phase 3.
          </div>
        )}
        {tab === "qualification" && <LeadQualification lead={lead} onRefresh={onRefresh} />}
        {tab === "sequence" && <LeadSequence leadId={lead.id} />}
        {tab === "notes" && (
          <div className="p-4 text-[11px] text-jarvis-muted">
            Notes tab — free-form notes + call summaries. Full implementation in Phase 3.
          </div>
        )}
        {tab === "approvals" && (
          <div className="p-4 text-[11px] text-jarvis-muted">
            Approval history. Full implementation in Phase 3 (Approvals Layer).
          </div>
        )}
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add src/components/sales/LeadDetailPanel.jsx src/components/sales/LeadResearch.jsx src/components/sales/LeadQualification.jsx src/components/sales/LeadSequence.jsx src/components/sales/ConvertToDeal.jsx
git commit -m "feat: LeadDetailPanel rewrite — 7 tabs, badges, scores, NBA, convert-to-deal"
```

---

## Task 8: Deal Room Enhancements — Discovery + Objections Tabs

**Files:**
- Create: `src/components/sales/DealDiscovery.jsx`
- Create: `src/components/sales/DealObjections.jsx`
- Modify: `src/components/sales/DealRoomPanel.jsx`

- [ ] **Step 1: Create `src/components/sales/DealDiscovery.jsx`**

```jsx
// Discovery requirements grid — structured discovery for deals.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";

const STATUS_COLORS = {
  unknown: "bg-jarvis-danger/10 text-jarvis-danger",
  partial: "bg-jarvis-warning/10 text-jarvis-warning",
  complete: "bg-jarvis-success/10 text-jarvis-success",
};

export function DealDiscovery({ dealId }) {
  const [reqs, setReqs] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!supabase || !dealId) return;
    const { data } = await supabase.from("discovery_requirements").select("*").eq("deal_id", dealId).order("category");
    setReqs(data || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [dealId]);

  const updateReq = async (id, fields) => {
    if (!supabase) return;
    await supabase.from("discovery_requirements").update({
      ...fields,
      answered_at: fields.answer ? new Date().toISOString() : null,
      status: fields.answer ? "complete" : "partial",
    }).eq("id", id);
    refresh();
  };

  if (loading) return <div className="text-[10px] text-jarvis-muted animate-pulse p-4">Loading…</div>;

  const complete = reqs.filter(r => r.status === "complete").length;
  const pct = reqs.length > 0 ? Math.round((complete / reqs.length) * 100) : 0;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-jarvis-ghost uppercase tracking-wider">Discovery Requirements</div>
        <div className="text-[11px] font-semibold text-jarvis-ink">{pct}% complete</div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full bg-jarvis-success rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>

      {reqs.length === 0 ? (
        <div className="text-center py-6 text-[11px] text-jarvis-ghost">No discovery requirements yet.</div>
      ) : (
        <div className="space-y-2">
          {reqs.map(r => (
            <div key={r.id} className="surface p-3">
              <div className="flex items-center justify-between mb-1.5">
                <div className="text-[9px] text-jarvis-muted uppercase tracking-wider">{r.category?.replace(/_/g, " ")}</div>
                <span className={`text-[8px] px-2 py-0.5 rounded font-semibold ${STATUS_COLORS[r.status] || STATUS_COLORS.unknown}`}>
                  {r.status}
                </span>
              </div>
              <div className="text-[11px] text-jarvis-ink font-medium mb-1.5">{r.question}</div>
              <input
                type="text"
                value={r.answer || ""}
                onChange={e => updateReq(r.id, { answer: e.target.value })}
                placeholder="Type answer…"
                className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1 text-[11px] text-jarvis-ink placeholder:text-jarvis-ghost"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/sales/DealObjections.jsx`**

```jsx
// Objection tracker — track concerns, mark resolved.

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { Plus, Check } from "lucide-react";

export function DealObjections({ dealId }) {
  const [objections, setObjections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newObj, setNewObj] = useState("");

  const refresh = async () => {
    if (!supabase || !dealId) return;
    const { data } = await supabase.from("objections").select("*").eq("deal_id", dealId).order("raised_at", { ascending: false });
    setObjections(data || []);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, [dealId]);

  const addObjection = async () => {
    if (!supabase || !newObj.trim()) return;
    await supabase.from("objections").insert({ deal_id: dealId, objection: newObj.trim() });
    setNewObj("");
    setAdding(false);
    refresh();
  };

  const updateObjection = async (id, fields) => {
    if (!supabase) return;
    await supabase.from("objections").update(fields).eq("id", id);
    refresh();
  };

  if (loading) return <div className="text-[10px] text-jarvis-muted animate-pulse p-4">Loading…</div>;

  const open = objections.filter(o => o.status === "open").length;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[10px] text-jarvis-ghost uppercase tracking-wider">
          Objections {open > 0 && <span className="text-jarvis-danger">· {open} open</span>}
        </div>
        <button
          onClick={() => setAdding(true)}
          className="text-[10px] px-2.5 py-1 rounded-md bg-jarvis-primary/10 text-jarvis-primary font-medium flex items-center gap-1"
        >
          <Plus size={10} /> Add
        </button>
      </div>

      {adding && (
        <div className="surface p-3 space-y-2">
          <input
            type="text"
            value={newObj}
            onChange={e => setNewObj(e.target.value)}
            placeholder="What's the concern?"
            className="w-full bg-jarvis-bg border border-jarvis-border rounded px-2 py-1.5 text-[11px] text-jarvis-ink"
            autoFocus
            onKeyDown={e => e.key === "Enter" && addObjection()}
          />
          <div className="flex gap-2">
            <button onClick={addObjection} className="text-[10px] px-3 py-1 rounded bg-jarvis-primary/15 text-jarvis-primary font-medium">Save</button>
            <button onClick={() => setAdding(false)} className="text-[10px] px-3 py-1 rounded bg-white/5 text-jarvis-muted">Cancel</button>
          </div>
        </div>
      )}

      {objections.length === 0 && !adding ? (
        <div className="text-center py-6 text-[11px] text-jarvis-ghost">No objections logged. Good sign.</div>
      ) : (
        <div className="space-y-2">
          {objections.map(o => (
            <div key={o.id} className={`surface p-3 ${o.status === "resolved" ? "opacity-50" : ""}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <div className="text-[11px] text-jarvis-ink">{o.objection}</div>
                  {o.response && <div className="text-[10px] text-jarvis-muted mt-1">Response: {o.response}</div>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[8px] px-2 py-0.5 rounded font-semibold ${
                    o.status === "open" ? "bg-jarvis-danger/10 text-jarvis-danger" :
                    o.status === "addressed" ? "bg-jarvis-warning/10 text-jarvis-warning" :
                    "bg-jarvis-success/10 text-jarvis-success"
                  }`}>{o.status}</span>
                  {o.status !== "resolved" && (
                    <button
                      onClick={() => updateObjection(o.id, { status: "resolved", resolved_at: new Date().toISOString() })}
                      className="text-jarvis-success hover:bg-jarvis-success/10 rounded p-1 transition"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Add Discovery + Objections tabs to DealRoomPanel**

In `src/components/sales/DealRoomPanel.jsx`, add the imports at the top:

```jsx
import { BadgeZone } from "../shared/BadgeZone.jsx";
import { ScoreZone } from "../shared/ScoreZone.jsx";
import { NBAModule } from "../shared/NBAModule.jsx";
import { DealDiscovery } from "./DealDiscovery.jsx";
import { DealObjections } from "./DealObjections.jsx";
import { dealHealth, whaleQuadrant } from "../../lib/dealHealth.js";
```

Add "discovery" and "objections" to the tab list. In the tab rendering section, add:

```jsx
{tab === "discovery" && <DealDiscovery dealId={dealId} />}
{tab === "objections" && <DealObjections dealId={dealId} />}
```

Add BadgeZone, ScoreZone, and NBAModule to the panel header area, after the deal name/value display. Compute scores:

```jsx
const { score: health, whale, quality, breakdown } = dealHealth(deal);
const quadrant = whaleQuadrant(whale, health);
```

Render in the header:
```jsx
<BadgeZone record={{ ...deal, quality, attention: deal.attention }} type="deal" />
<ScoreZone score={health} whale={whale} breakdown={breakdown} labels={{ score: "Health", whale: "Whale" }} />
```

- [ ] **Step 4: Test in browser**

Open the app, go to Work → Sales → Deals tab. Click any deal. The DealRoomPanel should now show badges, scores, and have Discovery + Objections tabs.

- [ ] **Step 5: Commit**

```bash
git add src/components/sales/DealDiscovery.jsx src/components/sales/DealObjections.jsx src/components/sales/DealRoomPanel.jsx
git commit -m "feat: Deal room enhanced — badges, scores, Discovery + Objections tabs"
```

---

## Task 9: Enhance PipelineBoard with Badges

**Files:**
- Modify: `src/components/sales/PipelineBoard.jsx`

- [ ] **Step 1: Add badge display to deal cards**

In `src/components/sales/PipelineBoard.jsx`, import the badge utilities:

```jsx
import { QUALITY_COLORS, QUALITY_LABELS, ATTENTION_COLORS, ATTENTION_LABELS } from "../../lib/badges.js";
import { dealHealth } from "../../lib/dealHealth.js";
```

In the `DealCard` component, after the existing AGE and SCORE badges, add quality and attention badges if the deal has them:

```jsx
{deal.quality && (
  <Badge
    label={QUALITY_LABELS[deal.quality] || deal.quality}
    value=""
    colorKey={deal.quality === "whale" ? "success" : deal.quality === "excellent" ? "success" : "ghost"}
  />
)}
{deal.attention && deal.attention !== "warm" && (
  <div className={`text-[7px] px-1.5 py-0.5 rounded font-semibold ${ATTENTION_COLORS[deal.attention] || ""}`}>
    {ATTENTION_LABELS[deal.attention] || deal.attention}
  </div>
)}
```

- [ ] **Step 2: Test — deal cards show badges**

Open app → Work → Deals → pipeline. Deal cards should show quality and attention badges when those fields are populated on the deal record.

- [ ] **Step 3: Commit**

```bash
git add src/components/sales/PipelineBoard.jsx
git commit -m "feat: PipelineBoard — quality and attention badges on deal cards"
```

---

## Task 10: Final Integration Test + Cleanup

- [ ] **Step 1: Full smoke test**

Open the app. Test this flow:
1. Work → Sales mode → click **Leads** tab → see empty table with filter chips
2. Click **+ New Lead** → lead appears in table
3. Click the lead row → LeadDetailPanel opens with 7 tabs
4. Go to Qualification tab → fill in some answers → Save
5. Go to Research tab → see "No research yet" message
6. Close panel → back to Leads tab → lead shows in table
7. Switch to **Deals** tab → existing 3-column layout works
8. Click a deal → DealRoomPanel shows badges, scores, Discovery + Objections tabs
9. Switch to **Playbook** tab → unchanged, all 7 panels render

- [ ] **Step 2: Verify no regressions in Trading and Build modes**

Switch to Trading mode → TradingDashboard renders. Switch to Build mode → BuildDashboard renders. No errors.

- [ ] **Step 3: Commit any cleanup**

```bash
git add -A
git commit -m "chore: Phase 1+2 integration cleanup"
```

---

## Summary

| Task | What it delivers |
|------|-----------------|
| 1 | 13 new Supabase tables + deals enhancement |
| 2 | Lead scoring, deal health, whale scoring, badges, NBA engine |
| 3 | Leads data hook with realtime + client-side scoring |
| 4 | Shared components: BadgeZone, ScoreZone, NBAModule, ActivityTimeline |
| 5 | LeadsTab table + LeadRow with full badge/score/NBA display |
| 6 | Wire Leads tab into Work view — 3-tab layout |
| 7 | LeadDetailPanel rewrite — 7 tabs, research, qualification, sequence, convert |
| 8 | DealDiscovery + DealObjections + DealRoomPanel enhancement |
| 9 | PipelineBoard badge enhancement |
| 10 | Integration test + cleanup |

**After Phase 1+2:** You have a working CRM with a proper leads inbox, lead-to-deal conversion, 4-layer badges, 3 scoring algorithms, NBA on every record, discovery tracking, objection tracking, and a unified activity timeline. Pipedrive becomes a data feeder, not your operating surface.
