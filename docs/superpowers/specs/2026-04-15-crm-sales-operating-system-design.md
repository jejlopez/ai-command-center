# CRM Sales Operating System — Architecture & Design

**Date:** 2026-04-15
**Status:** Pending approval
**Branch:** codex/jarvis-phase-3

---

## Problem

The current Sales tab has a 3-column deals layout, basic leads from Pipedrive, email inbox, proposals, and a playbook — but no proper leads management, no workflow engine, no approval system, no scoring beyond basic deal score, no learning loop, and no Jarvis automation beyond research and email triage. The operator still uses Pipedrive as the source of truth for leads and relies on manual judgment for prioritization, follow-up timing, and next actions.

## Solution

Build a full CRM sales operating system inside the existing Work view's Sales mode. Three tabs: **Leads | Deals | Playbook**. Every lead and deal gets 4-layer badges, composite scoring, a strike/sequence engine, next-best-action recommendations, an approval workflow, and a learning loop. Jarvis evolves from assistant to supervised operator to autonomous executor. The system replaces Pipedrive as the operational CRM while keeping Pipedrive sync as a data source.

## Approach

**Approach A (selected):** Expand the existing Sales mode. Keep Work view's 3-mode structure (Sales/Trading/Build). Inside Sales mode, replace Sales/Playbook toggle with Leads | Deals | Playbook tabs. All existing components (PipelineBoard, DealRoomPanel, ProposalGenerator, EmailInbox, StatsBar, PlaybookTab) stay and get enhanced. New components layer on top.

---

## 1. Architecture Overview

```
WORK VIEW — Sales Mode
├── StatsBar (enhanced — shows lead/deal/sequence/approval counts)
├── Sales Command Briefing (NEW — collapsible daily priority stack)
├── Leads Tab (NEW)
│   ├── Lead inbox table (badges, scores, NBA, quick actions)
│   └── LeadDetailPanel slide-out (7 tabs)
├── Deals Tab (enhanced)
│   ├── PipelineBoard (existing, enhanced with badges)
│   ├── EmailInbox (existing)
│   ├── Proposals (existing)
│   ├── Calendar + Follow-ups (existing)
│   └── DealRoomPanel slide-out (9 tabs, 2 new)
└── Playbook Tab (existing, unchanged)

BACKEND ENGINES
├── Scoring Engine (lead score, deal health, whale score, NBA)
├── Sequence Engine (strike tracking, cadence, behavioral triggers)
├── Approval Gateway (Draft → Review → Comment → Refine → Approve → Send)
└── Learning Loop (draft diffs, outcome tracking, feedback to Jarvis)

DATA LAYER
├── Supabase (11 existing + 12 new tables)
├── jarvisd (skills, connectors, cron)
└── Pipedrive sync (leads + deals import)
```

---

## 2. Database Schema

### Existing tables (keep, some enhanced)

- `deals` — enhanced with 12 new columns (see below)
- `proposals` — unchanged
- `follow_ups` — unchanged
- `communications` — unchanged
- `documents` — unchanged
- `templates` — unchanged
- `email_triage` — unchanged (jarvisd Gmail sync)
- `agents`, `tasks`, `activity_log`, `schedules` — unchanged

### Enhanced: `deals` table — new columns

```sql
quality              text,     -- whale, excellent, strong, medium, weak, bad_fit
attention            text,     -- hot, warm, stale, at_risk, blocked
strike_count         int default 0,
health_score         int,      -- 0-100
whale_score          int,      -- 0-100
next_best_action     jsonb,    -- { action, reason, due_at, priority }
volumes              jsonb,    -- { monthly_orders, avg_sku_count, pallet_count }
services_needed      text[],   -- ['pick_pack', 'storage', 'returns', 'kitting']
decision_maker       text,
timeline             text,     -- 'immediate', '30_days', '60_days', 'exploring'
current_provider     text,
switch_reason        text,
converted_from_lead_id uuid
```

### New tables

**`leads`** — core lead record
```sql
leads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company text not null,
  contact_id uuid references contacts(id),
  source text,                -- pipedrive, manual, inbound, referral, web
  status text default 'new',  -- new, researching, ready_to_email, sequence_active,
                              -- waiting, discovery_set, qualified, converted, nurture, dead
  quality text,               -- whale, excellent, strong, medium, weak, bad_fit
  attention text,             -- hot, warm, stale, at_risk, blocked
  strike_count int default 0,
  lead_score int,
  whale_score int,
  next_best_action jsonb,
  research_packet jsonb,      -- summary cache from latest research_packets row
  qualification jsonb,        -- smart filter answers
  pipedrive_id int,
  deal_id uuid references deals(id),
  converted_at timestamptz,
  notes text,
  tags text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

**`contacts`** — shared across leads and deals
```sql
contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  title text,
  company text,
  linkedin_url text,
  is_decision_maker boolean default false,
  notes text,
  pipedrive_id int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
)
```

**`activities`** — unified timeline for leads AND deals
```sql
activities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  contact_id uuid references contacts(id),
  type text not null,         -- email_sent, email_received, call, meeting, note,
                              -- proposal_sent, proposal_viewed, stage_change,
                              -- research_completed, jarvis_action, approval_decision
  subject text,
  body text,
  metadata jsonb,
  source text,                -- manual, jarvis, pipedrive, gmail, system
  occurred_at timestamptz default now(),
  created_at timestamptz default now()
)
```

**`sequences`** + **`sequence_steps`** — strike/cadence engine
```sql
sequences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  deal_id uuid references deals(id) on delete cascade,
  type text not null,         -- lead_outreach, deal_follow_up, proposal_follow_up
  status text default 'active', -- active, paused, completed, cancelled
  current_step int default 0,
  started_at timestamptz default now(),
  completed_at timestamptz,
  next_fire_at timestamptz
)

sequence_steps (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid not null references sequences(id) on delete cascade,
  step_number int not null,
  action text not null,       -- email, call, wait, check_engagement, escalate
  delay_days int not null,
  template_id uuid references templates(id),
  status text default 'pending', -- pending, ready, completed, skipped
  completed_at timestamptz,
  result jsonb,               -- { opened, replied, call_connected, etc. }
  behavioral_override jsonb
)
```

**`approvals`** — Draft → Review → Approve → Send
```sql
approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id),
  deal_id uuid references deals(id),
  type text not null,         -- email, proposal, stage_change, field_update, follow_up
  status text default 'pending', -- pending, approved, rejected, revised
  draft_content jsonb,
  final_content jsonb,
  user_edits jsonb,
  user_comment text,
  source_agent text,
  created_at timestamptz default now(),
  decided_at timestamptz
)
```

**`learning_events`** — edit-and-learn loop
```sql
learning_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  approval_id uuid references approvals(id),
  lead_id uuid references leads(id),
  deal_id uuid references deals(id),
  event_type text not null,   -- draft_edited, draft_rejected, email_replied,
                              -- proposal_accepted, deal_won, deal_lost, sequence_completed
  ai_draft jsonb,
  final_version jsonb,
  diff_summary jsonb,         -- { tone_changed, cta_changed, pricing_changed, length_changed }
  outcome jsonb,              -- { replied, opened, converted, closed, stalled }
  created_at timestamptz default now()
)
```

**`research_packets`** — versioned deep research
```sql
research_packets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid not null references leads(id) on delete cascade,
  version int default 1,
  company_overview text,
  what_they_do text,
  ecommerce_signals text,
  estimated_volume text,
  revenue_clues text,
  tech_stack text,
  linkedin_info text,
  pain_points text,
  buying_triggers text,
  qualification_notes text,
  recommended_angle text,
  raw_sources jsonb,
  generated_by text,
  created_at timestamptz default now()
)
```

**`tracking_events`** — behavioral signal layer
```sql
tracking_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lead_id uuid references leads(id),
  deal_id uuid references deals(id),
  contact_id uuid references contacts(id),
  event_type text not null,   -- email_opened, email_clicked, proposal_viewed,
                              -- proposal_downloaded, reply_received, bounce, unsubscribe
  source text,                -- gmail, pandadoc, website, manual
  metadata jsonb,
  occurred_at timestamptz default now()
)
```

**`audit_log`** — hash-chained trust layer
```sql
audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  actor text not null,        -- jarvis, user, system, pipedrive_sync
  action text not null,       -- draft_created, email_sent, score_changed, badge_changed,
                              -- stage_changed, approval_decided, nba_updated,
                              -- sequence_advanced, lead_converted
  entity_type text not null,  -- lead, deal, proposal, email, sequence
  entity_id uuid,
  before_state jsonb,
  after_state jsonb,
  reason text,
  prev_hash text,
  created_at timestamptz default now()
)
```

**`objections`** — deal-specific concern tracking
```sql
objections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  objection text not null,
  response text,
  status text default 'open', -- open, addressed, resolved
  raised_at timestamptz default now(),
  resolved_at timestamptz
)
```

**`discovery_requirements`** — structured discovery
```sql
discovery_requirements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  category text not null,     -- volume, services, timeline, budget, decision_process, current_provider
  question text not null,
  answer text,
  status text default 'unknown', -- unknown, partial, complete
  asked_at timestamptz,
  answered_at timestamptz
)
```

**`win_loss_reviews`** — post-mortem on closed deals
```sql
win_loss_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  deal_id uuid not null references deals(id) on delete cascade,
  outcome text not null,      -- won, lost
  primary_reason text,
  what_worked text,
  what_didnt text,
  lost_to text,               -- competitor name or 'stayed_in_house'
  would_change text,
  created_at timestamptz default now()
)
```

All tables get RLS policies: `using (auth.uid() = user_id) with check (auth.uid() = user_id)`.

**Total: 11 existing (1 enhanced) + 13 new = 24 tables.**

---

## 3. Badge System — 4 Layers

Every lead and deal displays all 4 badges.

### Process Badge
Where they are in the workflow. Set by stage transitions.

**Lead stages:** New → Researching → Ready to Email → Sequence Active → Waiting → Discovery Set → Qualified → Converted → Nurture → Dead

**Deal stages:** Discovery → Proposal Drafting → Proposal Sent → Negotiating → Closing → Won → Lost

Trigger: manual stage change or Jarvis recommendation (approved).

### Strike Badge
Outreach/follow-up touch count. S0 through S5. Auto-incremented on outbound activities only (email sent, call attempted, meeting held, proposal sent). Inbound replies are engagement signals, not strikes.

### Quality Badge
Business fit. Derived from scoring engine.

| Badge | Score Range |
|-------|------------|
| 🐋 Whale | 90-100 |
| Excellent | 75-89 |
| Strong | 60-74 |
| Medium | 40-59 |
| Weak | 20-39 |
| Bad Fit | 0-19 |

Trigger: recomputed on research_packet update, qualification change, or manual override.

### Attention Badge
Urgency. Computed from behavioral signals.

| Badge | Rule |
|-------|------|
| 🔥 Hot | Engagement spike in last 24h (multiple opens, reply, proposal view + click) OR discovery call set for today/tomorrow |
| Warm | Activity in last 3 days, sequence on track, no red flags |
| Stale | No activity for 5-10 days, no opens on last email |
| ⚠ At Risk | 10+ days silent, proposal sent but no engagement, objection unresolved, stage aging past threshold |
| 🚫 Blocked | Missing critical info, awaiting internal approval, contact unreachable, competitor lock-in |

Trigger: recomputed on every tracking_event, activity, or sequence_step.

---

## 4. Scoring Engine — 3 Algorithms

### Lead Score (0-100)

| Factor | Points |
|--------|--------|
| ICP / company fit (3PL-relevant, D2C, e-comm) | 0-25 |
| Estimated order volume | 0-20 |
| Revenue potential | 0-15 |
| Engagement signals (opens, replies, calls) | 0-15 |
| Decision-maker access | 0-10 |
| Urgency / timeline | 0-10 |
| Strategic value | 0-5 |

**Disqualification deductions:** no website/no e-comm = -15, bad fit vertical = -20, unreachable contact = -10, competitor lock-in >12mo = -10.

### Deal Health Score (0-100)

| Factor | Points |
|--------|--------|
| Recency of activity (<3d = full, >10d = 0) | 0-20 |
| Proposal engagement (viewed, downloaded, questions) | 0-20 |
| Reply behavior (responsive, slow, ghosting) | 0-15 |
| Next step clarity (scheduled vs vague vs none) | 0-15 |
| Discovery completeness (% requirements answered) | 0-10 |
| Buyer urgency (timeline, budget confirmed) | 0-10 |
| Objection status (resolved vs open) | 0-10 |

**Penalties:** stage aging past threshold = -5/week, unanswered questions >3 = -10, no proposal engagement after 5d = -15.

### Whale Score (0-100) — The Buffett Filter

| Factor | Points |
|--------|--------|
| Annual revenue potential | 0-30 |
| Monthly order volume | 0-25 |
| Multi-service potential | 0-20 |
| Growth trajectory | 0-15 |
| Strategic value | 0-10 |

**Whale Quadrant:**

| Category | Whale Score | Health Score | Action |
|----------|------------|-------------|--------|
| 🐋 True Whale | ≥80 | ≥60 | Top priority |
| 💎 Strong Regular | 40-79 | ≥60 | Bread and butter |
| ⚡ Fast Close | <40 | ≥70 | Easy revenue |
| 🎣 Long-shot Whale | ≥80 | <40 | Nurture, don't chase |
| 👻 Fake Active | <40 | <40 | Deprioritize |

### Next-Best-Action Engine

Stored as JSON on every lead/deal: `{ action, reason, due_at, priority }`. Recomputed on every activity, tracking event, sequence step, or timer.

NBA priority sorts the entire work queue: True Whales + Hot = top, Fake Active + Stale = bottom.

---

## 5. Sequence Engine

### Lead Outreach Sequence (5 strikes to discovery)

| Step | Day | Action | Behavioral Override |
|------|-----|--------|-------------------|
| S0 | 0 | Research + Draft email | — |
| S1 | 0-1 | Email #1 — opening angle | — |
| S2 | 3 | Call #1 | If email opened 2x+ → call Day 2 |
| S3 | 6 | Email #2 — value add | If call connected → skip, pivot to discovery |
| S4 | 10 | Call #2 | If email #2 opened but no reply → call Day 8 |
| S5 | 14 | Email #3 — breakup | After S5: nurture if quality ≥ Medium, else dead |

### Deal Follow-Up Sequence (5 strikes to signature)

| Step | Day | Action | Behavioral Override |
|------|-----|--------|-------------------|
| S0 | 0 | Proposal sent | — |
| S1 | 2 | Check-in call | If proposal viewed 3x+ Day 0-1 → call immediately |
| S2 | 5 | Email — objection preempt | If they replied with questions → skip, address questions |
| S3 | 8 | Call — decision check | If no proposal views → different script |
| S4 | 12 | Email — urgency/scarcity | — |
| S5 | 16 | Call — final push or close | After S5 no engagement → At Risk / Lost |

### Behavioral Override Rules

| Signal | Override | Why |
|--------|---------|-----|
| Email opened 3x+ in <4h | CALL NOW | Active interest |
| Reply received | Pause sequence | Conversation started |
| Proposal viewed, no reply 3d | Skip to phone step | Interest without commitment |
| Proposal viewed 5x+, forwarded | CALL + prep for committee | Multiple stakeholders |
| Zero opens on last 2 emails | Switch to phone-only | Email not landing |
| Bounce detected | Flag contact, verify email | Bad address |
| "Not now" / delay reply | Pause, schedule 30-day check | Respect timeline |
| Meeting scheduled via calendar | Pause until after meeting | Don't email before a call |
| Objection logged | Replace next email with objection response | Address real concern |

### Engine Runtime

Runs every 15 minutes via jarvisd cron. For each active sequence: check tracking_events for behavioral overrides, check if next_fire_at ≤ now, execute current step action (email → creates approval, call → creates NBA, wait → sets next timer), log to activities + audit_log, update badges + strike_count + NBA.

**Key constraint:** Emails NEVER auto-send. Jarvis drafts → approval queue → operator decides. Calls = NBA recommendation only.

---

## 6. Approval & Trust Architecture

### Approval Flow

```
Jarvis creates draft
  → approval record (status: pending)
  → operator reviews
  → operator edits / comments
  → operator approves or rejects
  → if approved: action executes, final_content saved
  → if rejected: reason captured, Jarvis learns
  → learning_event created with diff
  → audit_log entry created
```

### What Requires Approval

| Action | Mode: Assistant | Mode: Supervised | Mode: Autonomous |
|--------|---------------|-----------------|-----------------|
| Send email | Always | Always | Auto (within limits) |
| Send proposal | Always | Always | Always |
| Stage change | Always | Auto for forward moves | Auto |
| Field updates | Auto | Auto | Auto |
| Follow-up recommendation | Suggestion only | Auto-draft, await approval | Auto-send |
| Delete/forward email | BLOCKED | BLOCKED | BLOCKED |

### Audit Trail

Every action logged to `audit_log` with actor, action, entity, before_state, after_state, reason, and hash chain. Operator can inspect: what Jarvis did, what Jarvis suggested, what was changed, what got sent, why scores/badges/NBA changed.

---

## 7. Learning Loop

### What Gets Captured

For every approval decision:
- AI draft (original)
- User edits (structured diff: subject, tone, CTA, pricing, length)
- User comment (why they changed it)
- Final version (what was sent)
- Buyer response (from tracking_events)
- Eventual outcome (from deal status)

### What the System Learns From

| Signal | Learning |
|--------|---------|
| User rewrites subject lines | Adjust subject style for this user |
| User always lowers storage pricing for e-comm | Pre-apply discount for e-comm proposals |
| User rejects formal tone | Switch to conversational default |
| Emails with case studies get 2x replies | Include case studies more often |
| Deals stalling past 25 days close at 8% | Recommend deprioritize or final push earlier |
| Win rate vs ShipBob is 60% with international angle | Lead with international for ShipBob competitors |

### Safety

- Learning is read-only advisory — Jarvis adjusts drafts, operator still approves
- All learning events are inspectable in the Approvals tab
- Score/badge changes always show reason in audit_log
- No autonomous behavior changes without operator seeing the pattern first
- Learning can be reset per-category if it drifts

---

## 8. UI Layout

### Sales Mode — 3 Tabs

**StatsBar (enhanced):** Pipeline value, total leads, active sequences, hot leads, discovery calls set, proposals out, overdue follow-ups, pending approvals. Leads | Deals | Playbook tab switcher.

**Sales Command Briefing (NEW):** Collapsible strip below StatsBar. Jarvis-generated daily priority stack: hot leads to call, proposals needing follow-up, deals at risk, stale leads, new leads being researched. Pipeline summary, win rate, approval queue count.

### Leads Tab

Full-width table: Company/Contact | Quality | Attention | Strike | Score | Status | Next Best Action. Sorted by NBA priority. Filter chips: Hot, Whale, Sequence Active, Stale, All. New Lead + Sync Pipedrive actions. Click row → LeadDetailPanel slide-out. Hover row → quick action buttons (Call, Email, Log Call, Note, Approve, Snooze, Convert).

### LeadDetailPanel (7 tabs)

**Header:** Company, contact, age, source. Badge zone (4 badges). Score zone (lead score, whale score, breakdown). NBA module with action buttons.

| Tab | Content |
|-----|---------|
| Timeline | Unified chronological feed — emails, calls, opens, research, approvals, badge changes |
| Research | Full research packet — company, signals, volume, tech stack, pain points, angle. Version history. |
| Emails | All emails for this contact. IN/OUT badges, open counts. Draft new → approval. |
| Qualification | Smart Filter questions. Jarvis pre-fills from research. Updates score real-time. |
| Sequence | Visual 5-strike progress. Behavioral overrides. Pause/resume. |
| Notes | Free-form + auto-generated call summaries. Pinnable. |
| Approvals | Every Jarvis action that needed sign-off. What proposed vs what sent. |

**Convert to Deal:** Button in header when qualified. Creates deal, links contact, copies history, pre-fills discovery, cancels lead sequence, starts deal sequence.

### Deals Tab

Existing 3-column layout (PipelineBoard, Proposals + Email, Calendar + Follow-ups). Pipeline cards enhanced with 4 badges. Click deal → DealRoomPanel slide-out.

### DealRoomPanel (9 tabs)

**Header:** Company, contact, deal value, probability, age, converted-from link. Badge zone (4 badges + whale quadrant label). Score zone (health, whale, breakdown). NBA module with action buttons. Pipeline economics strip (est. monthly revenue, annual value, margin, time-to-close).

| Tab | Content | Status |
|-----|---------|--------|
| Timeline | Unified activity feed | Enhanced |
| Proposals | Version history, pricing summary, view tracking, learning annotations, generate new | Enhanced |
| Discovery | Structured requirements grid (volumes, services, timeline, budget, decision, provider). % complete. | NEW |
| Emails | All threads for contact + deal. Draft → approval. | Enhanced |
| Objections | Track concerns. Open → addressed → resolved. Jarvis suggests responses. | NEW |
| Sequence | Deal follow-up 5-strike progress. Behavioral overrides. | NEW |
| Notes | Free-form + call summaries. Pinnable. | Enhanced |
| Approvals | Full audit trail. | NEW |
| Docs | Contracts, rate sheets, SOWs, attachments. | Existing |

### Voice-to-CRM

Mic button on LeadDetailPanel and DealRoomPanel headers. Tap → speak → Jarvis transcribes, extracts structured data, logs call, updates fields, creates follow-ups, queues proposal generation. Uses existing VoiceButton component + Whisper transcription.

### Win/Loss Post-Mortem

When deal marked Won or Lost, structured form appears: primary reason, what worked, what didn't, lost to whom, what you'd change. Saved to `win_loss_reviews`. Feeds learning loop.

---

## 9. Jarvis Evolution Path

| Mode | Trust Level | What Jarvis Does | What Requires Approval |
|------|------------|------------------|----------------------|
| **Assistant** (Phase 5) | Low | Research, summarize, draft, recommend | Everything outbound |
| **Supervised** (Phase 6) | Medium | Auto-draft, auto-sequence, auto-score, auto-badge | Emails, proposals, sensitive changes |
| **Autonomous** (Phase 7) | High | Execute sequences, send follow-ups, update CRM, escalate exceptions | Proposals, new outreach to whales, budget-affecting actions |

Trust level is per-action-type, not global. Email sending might stay supervised while badge updates go autonomous.

---

## 10. Phased Implementation Plan

### Phase 1 — Foundation CRM (schema + core UI)
- Create all 13 new Supabase tables + migrations
- Enhance deals table with 12 new columns
- Build `contacts` shared entity + refactor existing contact references
- Build Leads tab (table, filters, StatsBar integration)
- Build LeadDetailPanel (header, badge zone, score zone, Timeline tab, Notes tab)
- Add Leads | Deals | Playbook tab switcher
- Pipedrive leads sync to new `leads` table
- `activities` table + unified timeline component (shared between lead/deal panels)

### Phase 2 — Workflow Structure
- Build `research_packets` table + Jarvis lead_research skill integration
- Build Research tab in LeadDetailPanel
- Build Qualification tab (smart filter questions)
- Build lead-to-deal conversion flow
- Build `sequences` + `sequence_steps` tables
- Build Sequence tab (visual progress, pause/resume)
- Build badge computation logic (all 4 layers)
- Build badge display components (shared between leads/deals)
- Enhance DealRoomPanel with badges, Discovery tab, Objections tab

### Phase 3 — Approvals Layer
- Build `approvals` table + approval queue
- Build Approvals tab (shared component)
- Wire email drafts through approval flow
- Wire proposal generation through approval flow
- Wire stage changes through approval flow
- Build `audit_log` table + hash chain logic
- Build audit inspection UI

### Phase 4 — Scoring Layer
- Build lead scoring algorithm (`lib/leadScore.js`)
- Build deal health scoring algorithm (replace `dealScore.js`)
- Build whale scoring algorithm (`lib/whaleScore.js`)
- Build NBA engine (`lib/nextBestAction.js`)
- Wire scoring to badge computation
- Build score breakdown display in panels
- Build whale quadrant classification
- NBA column in leads/deals tables

### Phase 5 — Jarvis Assist Mode
- Build Sales Command Briefing component
- Enhance lead_research skill with full research packet fields
- Build email draft skill (context-aware, uses research + history)
- Build call prep skill (pre-call summary)
- Build follow-up draft skill
- Build proposal suggestion skill (uses discovery requirements)
- Build `tracking_events` ingestion (email opens, proposal views)
- Wire tracking events to sequence engine behavioral overrides

### Phase 6 — Jarvis Operator Mode
- Build sequence engine cron (15-min tick in jarvisd)
- Auto-draft generation on sequence steps
- Auto-badge recomputation on events
- Auto-NBA updates
- Build quick actions (hover row → Call, Email, Log Call, Note, Approve, Snooze, Convert)
- Build voice-to-CRM (mic → transcribe → extract → update)
- Build pipeline economics (monthly revenue, margin, time-to-close)

### Phase 7 — Learning System
- Build `learning_events` capture on approval decisions
- Build structured diff extraction (tone, CTA, pricing, length changes)
- Build `win_loss_reviews` table + post-mortem form
- Wire outcome tracking (deal won/lost → learning_event)
- Build learning feedback into draft generation (Jarvis adjusts based on edit patterns)
- Build learning dashboard in Playbook tab (win rate by competitor, angle, timing)
- Build trust level controls in Settings

---

## 11. Risks & Tradeoffs

| Risk | Mitigation |
|------|-----------|
| Scope is large — 7 phases | Each phase delivers standalone value. Phase 1 alone replaces Pipedrive for leads. |
| Pipedrive sync lag | Keep Pipedrive as secondary, not primary. Leads table in Supabase is source of truth. |
| Scoring feels wrong initially | All scores are overridable. Learning loop adjusts weights based on outcomes. |
| Sequence engine sends bad emails | Emails NEVER auto-send. Always through approval. Even in autonomous mode, proposals require approval. |
| Learning loop drifts | Learning is advisory only. All changes inspectable. Reset per-category. |
| Too many tables | Each table has a clear purpose. No redundancy. RLS on all. |
| Voice transcription errors | Voice-to-CRM updates go through approval in supervised mode. User confirms extracted data. |

---

## 12. Smartest MVP Path

**Ship Phase 1 + 2 together.** This gives you:
- A real leads inbox (replaces Pipedrive leads view)
- Research packets on every lead
- Lead-to-deal conversion with full history
- 4-layer badge system on every record
- Sequence visual progress
- Discovery and objection tracking on deals

That's a working CRM you can use for real deals on Day 1. Phases 3-7 add intelligence and automation on top of a solid foundation.

**Phase 1+2 estimated scope:** 13 new tables, ~15 new components, ~5 enhanced components, 2 new scoring utilities, 1 new shared timeline component.
